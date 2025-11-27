const express = require('express');
const cors = require('cors');
const { pool, initializeDatabase } = require('./db');
const { register, login, verifyToken, getCurrentUser } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 认证中间件
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = verifyToken(token);
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend API is running' });
});

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await register(username, password, email || null);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await login(username, password);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: error.message });
  }
});

// 获取当前用户
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await getCurrentUser(req.userId);
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(404).json({ error: error.message });
  }
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// 启动服务器
const startServer = async () => {
  try {
    // 初始化数据库
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
