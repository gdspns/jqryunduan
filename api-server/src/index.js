const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// 数据库连接池
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'telegram_bot_manager',
  user: process.env.DB_USER || 'bot_admin',
  password: process.env.DB_PASSWORD,
});

// Bot服务WebSocket连接
let botServiceWs = null;

// 中间件
app.use(cors());
app.use(express.json());

// JWT验证中间件
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: '未授权' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: '令牌无效' });
  }
};

// 管理员验证中间件
const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '需要管理员权限' });
  }
  next();
};

// ==================== 试用相关API ====================

// 开始试用
app.post('/api/bots/trial', async (req, res) => {
  try {
    const { bot_token, developer_id, welcome_message } = req.body;

    if (!bot_token || !developer_id) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    // 生成唯一的bot_id
    const bot_id = uuidv4();

    // 插入试用记录到数据库
    await pool.query(
      `INSERT INTO trial_bots (bot_id, bot_token, developer_id, welcome_message, message_count, created_at)
       VALUES ($1, $2, $3, $4, 0, NOW())`,
      [bot_id, bot_token, developer_id, welcome_message || '欢迎使用！这是试用模式，您有20条免费消息。']
    );

    // 通知bot-service启动试用机器人
    if (botServiceWs && botServiceWs.readyState === WebSocket.OPEN) {
      botServiceWs.send(JSON.stringify({
        type: 'start_trial_bot',
        data: {
          bot_id,
          bot_token,
          developer_id,
          welcome_message
        }
      }));
    }

    res.json({
      success: true,
      bot_id,
      message: '试用已启动'
    });
  } catch (error) {
    console.error('启动试用失败:', error);
    res.status(500).json({ message: '启动试用失败: ' + error.message });
  }
});

// 发送试用消息
app.post('/api/bots/trial/message', async (req, res) => {
  try {
    const { bot_id, message } = req.body;

    if (!bot_id || !message) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    // 查询试用记录
    const result = await pool.query(
      'SELECT * FROM trial_bots WHERE bot_id = $1',
      [bot_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '试用记录不存在' });
    }

    const trialBot = result.rows[0];

    if (trialBot.message_count >= 20) {
      return res.status(403).json({ message: '试用已达到20条消息上限' });
    }

    // 更新消息计数
    await pool.query(
      'UPDATE trial_bots SET message_count = message_count + 1 WHERE bot_id = $1',
      [bot_id]
    );

    // 发送消息到bot-service
    if (botServiceWs && botServiceWs.readyState === WebSocket.OPEN) {
      botServiceWs.send(JSON.stringify({
        type: 'send_trial_message',
        data: {
          bot_id,
          bot_token: trialBot.bot_token,
          developer_id: trialBot.developer_id,
          message
        }
      }));
    }

    res.json({
      success: true,
      message_count: trialBot.message_count + 1,
      reply: '消息已发送到 Telegram'
    });
  } catch (error) {
    console.error('发送消息失败:', error);
    res.status(500).json({ message: '发送消息失败: ' + error.message });
  }
});

// ==================== 用户认证API ====================

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ message: '登录失败' });
  }
});

// ==================== 机器人管理API ====================

// 获取用户的机器人列表
app.get('/api/bots', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bots WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('获取机器人列表失败:', error);
    res.status(500).json({ message: '获取失败' });
  }
});

// 添加机器人
app.post('/api/bots', verifyToken, async (req, res) => {
  try {
    const { bot_token, developer_id, welcome_message } = req.body;

    const result = await pool.query(
      `INSERT INTO bots (user_id, bot_token, developer_id, welcome_message, status, created_at)
       VALUES ($1, $2, $3, $4, 'inactive', NOW())
       RETURNING *`,
      [req.user.id, bot_token, developer_id, welcome_message]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('添加机器人失败:', error);
    res.status(500).json({ message: '添加失败' });
  }
});

// ==================== 管理员API ====================

// 获取所有授权的机器人
app.get('/api/admin/bots', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, u.username FROM bots b
       LEFT JOIN users u ON b.user_id = u.id
       ORDER BY b.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('获取机器人列表失败:', error);
    res.status(500).json({ message: '获取失败' });
  }
});

// 授权机器人
app.post('/api/admin/bots/:id/authorize', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { expires_at } = req.body;

    await pool.query(
      'UPDATE bots SET status = $1, expires_at = $2 WHERE id = $3',
      ['active', expires_at, id]
    );

    res.json({ message: '授权成功' });
  } catch (error) {
    console.error('授权失败:', error);
    res.status(500).json({ message: '授权失败' });
  }
});

// 启动/停止机器人
app.post('/api/admin/bots/:id/toggle', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.query(
      'UPDATE bots SET status = $1 WHERE id = $2',
      [status, id]
    );

    res.json({ message: '操作成功' });
  } catch (error) {
    console.error('操作失败:', error);
    res.status(500).json({ message: '操作失败' });
  }
});

// 删除机器人
app.delete('/api/admin/bots/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM bots WHERE id = $1', [id]);
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({ message: '删除失败' });
  }
});

// ==================== WebSocket连接处理 ====================

// 连接到bot-service
function connectToBotService() {
  const botServiceUrl = process.env.BOT_SERVICE_WS_URL || 'ws://localhost:3001';
  
  botServiceWs = new WebSocket(botServiceUrl);

  botServiceWs.on('open', () => {
    console.log('已连接到bot-service');
  });

  botServiceWs.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('收到bot-service消息:', message);
    
    // 广播给所有连接的前端客户端
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  });

  botServiceWs.on('close', () => {
    console.log('与bot-service断开连接，5秒后重连...');
    setTimeout(connectToBotService, 5000);
  });

  botServiceWs.on('error', (error) => {
    console.error('bot-service连接错误:', error);
  });
}

// 处理前端WebSocket连接
wss.on('connection', (ws, req) => {
  console.log('新的前端WebSocket连接');

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('收到前端消息:', message);

    // 转发给bot-service
    if (botServiceWs && botServiceWs.readyState === WebSocket.OPEN) {
      botServiceWs.send(JSON.stringify(message));
    }
  });

  ws.on('close', () => {
    console.log('前端WebSocket连接关闭');
  });
});

// ==================== 健康检查 ====================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    botService: botServiceWs?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected'
  });
});

// ==================== 启动服务器 ====================

const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  console.log(`API服务器运行在端口 ${PORT}`);
  
  // 初始化数据库表
  try {
    await initDatabase();
    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }

  // 连接到bot-service
  connectToBotService();
});

// 初始化数据库表
async function initDatabase() {
  // 创建用户表
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 创建试用机器人表
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trial_bots (
      id SERIAL PRIMARY KEY,
      bot_id VARCHAR(100) UNIQUE NOT NULL,
      bot_token VARCHAR(255) NOT NULL,
      developer_id VARCHAR(50) NOT NULL,
      welcome_message TEXT,
      message_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 创建机器人表
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bots (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      bot_token VARCHAR(255) NOT NULL,
      developer_id VARCHAR(50) NOT NULL,
      welcome_message TEXT,
      status VARCHAR(20) DEFAULT 'inactive',
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 创建消息记录表
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      bot_id INTEGER REFERENCES bots(id),
      telegram_user_id VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      direction VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 创建默认管理员账号
  const adminExists = await pool.query(
    'SELECT * FROM users WHERE username = $1',
    ['admin']
  );

  if (adminExists.rows.length === 0) {
    const hashedPassword = await bcrypt.hash('qqai18301', 10);
    await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
      ['admin', hashedPassword, 'admin']
    );
    console.log('已创建默认管理员账号: admin / qqai18301');
  }
}
