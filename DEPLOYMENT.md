# Telegram 机器人管理系统 - 完整部署教程

本教程将指导您完成整个系统的部署，包括数据库、后端 API、Telegram Bot 服务和前端。

---

## 目录

1. [系统架构](#系统架构)
2. [环境准备](#环境准备)
3. [数据库部署](#数据库部署)
4. [后端 API 部署](#后端-api-部署)
5. [Telegram Bot 服务部署](#telegram-bot-服务部署)
6. [前端部署](#前端部署)
7. [使用 Docker 一键部署](#使用-docker-一键部署)
8. [常见问题](#常见问题)

---

## 系统架构

```
┌─────────────┐      HTTP/WS      ┌──────────────┐
│   前端网站   │ ◄──────────────► │  后端 API    │
│  (React)    │                   │  (Node.js)   │
└─────────────┘                   └──────┬───────┘
                                         │
                                         │ 读写数据
                                         ▼
                                  ┌──────────────┐
                                  │  PostgreSQL  │
                                  │  数据库      │
                                  └──────▲───────┘
                                         │
                                         │ 读写数据
                                         │
                                  ┌──────┴───────┐
                                  │  Bot 服务    │
                                  │  (Node.js)   │
                                  └──────┬───────┘
                                         │
                                         │ Telegram API
                                         ▼
                                  ┌──────────────┐
                                  │  Telegram    │
                                  │   Servers    │
                                  └──────────────┘
```

**关键点：**
- 前端：纯静态网站，通过 API 与后端通信
- 后端 API：处理用户认证、授权管理、数据操作
- Bot 服务：独立守护进程，24/7 运行，负责 Telegram 消息中转
- 数据库：存储所有数据

---

## 环境准备

### 1. 服务器要求

- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **内存**: 至少 2GB RAM
- **存储**: 至少 20GB 可用空间
- **带宽**: 稳定的网络连接

### 2. 必需软件安装

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version  # 应显示 v18.x.x
npm --version

# 安装 PM2（进程管理器）
sudo npm install -g pm2

# 安装 PostgreSQL 14
sudo apt install -y postgresql postgresql-contrib

# 安装 Nginx（用于反向代理）
sudo apt install -y nginx

# 安装 Git
sudo apt install -y git
```

---

## 数据库部署

### 1. 配置 PostgreSQL

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 在 psql 中执行以下命令：
```

```sql
-- 创建数据库
CREATE DATABASE telegram_bot_manager;

-- 创建用户
CREATE USER bot_admin WITH PASSWORD 'your_strong_password_here';

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE telegram_bot_manager TO bot_admin;

-- 退出
\q
```

### 2. 创建数据表

连接到数据库：

```bash
sudo -u postgres psql -d telegram_bot_manager
```

执行以下 SQL：

```sql
-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 机器人表
CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bot_token VARCHAR(255) UNIQUE NOT NULL,
  bot_name VARCHAR(100) NOT NULL,
  developer_id VARCHAR(50),
  welcome_message TEXT,
  status VARCHAR(20) DEFAULT 'active',
  trial_messages_sent INT DEFAULT 0,
  is_authorized BOOLEAN DEFAULT FALSE,
  expiry_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 激活链接表
CREATE TABLE activation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token VARCHAR(255) UNIQUE NOT NULL,
  activation_code VARCHAR(100) UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  expiry_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 消息表
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  telegram_user_id VARCHAR(50) NOT NULL,
  telegram_username VARCHAR(100),
  direction VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX idx_bots_user_id ON bots(user_id);
CREATE INDEX idx_bots_bot_token ON bots(bot_token);
CREATE INDEX idx_messages_bot_id ON messages(bot_id);
CREATE INDEX idx_messages_telegram_user_id ON messages(telegram_user_id);
CREATE INDEX idx_activation_links_code ON activation_links(activation_code);

-- 创建管理员账号
-- 密码: qqai18301 (已使用 bcrypt 加密)
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2b$10$YourBcryptHashHere', 'admin');
```

### 3. 配置数据库连接

允许远程连接（可选）：

```bash
# 编辑 PostgreSQL 配置
sudo nano /etc/postgresql/14/main/postgresql.conf

# 找到并修改：
listen_addresses = '*'

# 编辑访问控制
sudo nano /etc/postgresql/14/main/pg_hba.conf

# 添加：
host    all    all    0.0.0.0/0    md5

# 重启 PostgreSQL
sudo systemctl restart postgresql
```

---

## 后端 API 部署

### 1. 创建项目目录

```bash
mkdir -p /var/www/telegram-bot-api
cd /var/www/telegram-bot-api
```

### 2. 初始化 Node.js 项目

```bash
npm init -y
npm install express bcryptjs jsonwebtoken pg ws cors dotenv helmet express-rate-limit
```

### 3. 创建 .env 配置文件

```bash
nano .env
```

内容：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telegram_bot_manager
DB_USER=bot_admin
DB_PASSWORD=your_strong_password_here

# JWT 密钥
JWT_SECRET=your_jwt_secret_key_here_change_this

# 服务器配置
PORT=3000
NODE_ENV=production

# 前端 URL (用于 CORS)
FRONTEND_URL=https://yourdomain.com

# 激活链接基础 URL
ACTIVATION_BASE_URL=https://yourdomain.com/activate
```

### 4. 创建主应用文件

创建 `src/index.js`：

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bots');
const adminRoutes = require('./routes/admin');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

// 中间件
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/bots', authenticateToken, botRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);

// WebSocket 服务器
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');

  ws.on('message', (message) => {
    // 处理 WebSocket 消息
    console.log('Received:', message);
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 5. 创建数据库连接池

创建 `src/db.js`：

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
```

### 6. 创建认证中间件

创建 `src/middleware/auth.js`：

```javascript
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '未授权' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: '令牌无效' });
    }
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '需要管理员权限' });
  }
  next();
};

module.exports = { authenticateToken, isAdmin };
```

### 7. 使用 PM2 启动服务

```bash
# 启动应用
pm2 start src/index.js --name telegram-api

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs telegram-api

# 查看状态
pm2 status
```

### 8. 配置 Nginx 反向代理

```bash
sudo nano /etc/nginx/sites-available/telegram-api
```

内容：

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/telegram-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Telegram Bot 服务部署

### 1. 创建 Bot 服务目录

```bash
mkdir -p /var/www/telegram-bot-service
cd /var/www/telegram-bot-service
```

### 2. 安装依赖

```bash
npm init -y
npm install telegraf pg dotenv
```

### 3. 创建 Bot 服务主文件

创建 `src/bot-service.js`：

```javascript
const { Telegraf } = require('telegraf');
const pool = require('./db');
require('dotenv').config();

// 存储活动的 bot 实例
const activeBots = new Map();

// 启动单个 bot
async function startBot(botToken, botId) {
  if (activeBots.has(botId)) {
    console.log(`Bot ${botId} already running`);
    return;
  }

  try {
    const bot = new Telegraf(botToken);

    // 消息处理
    bot.on('message', async (ctx) => {
      const telegramUserId = ctx.from.id.toString();
      const telegramUsername = ctx.from.username || ctx.from.first_name;
      const messageText = ctx.message.text;

      // 保存消息到数据库
      await pool.query(
        `INSERT INTO messages (bot_id, telegram_user_id, telegram_username, direction, content)
         VALUES ($1, $2, $3, 'incoming', $4)`,
        [botId, telegramUserId, telegramUsername, messageText]
      );

      // 检查是否试用已结束
      const botResult = await pool.query(
        'SELECT is_authorized, trial_messages_sent FROM bots WHERE id = $1',
        [botId]
      );

      const botInfo = botResult.rows[0];
      if (!botInfo.is_authorized && botInfo.trial_messages_sent >= 20) {
        await ctx.reply('试用已结束，请联系管理员激活授权。');
        return;
      }

      // 通知 WebSocket 客户端有新消息
      // (这里需要实现与 API 服务器的通信)
    });

    await bot.launch();
    activeBots.set(botId, bot);
    console.log(`Bot ${botId} started successfully`);
  } catch (error) {
    console.error(`Failed to start bot ${botId}:`, error);
  }
}

// 停止单个 bot
function stopBot(botId) {
  const bot = activeBots.get(botId);
  if (bot) {
    bot.stop();
    activeBots.delete(botId);
    console.log(`Bot ${botId} stopped`);
  }
}

// 加载所有活动的 bots
async function loadActiveBots() {
  try {
    const result = await pool.query(
      "SELECT id, bot_token FROM bots WHERE status = 'active' AND is_authorized = true"
    );

    for (const bot of result.rows) {
      await startBot(bot.bot_token, bot.id);
    }

    console.log(`Loaded ${result.rows.length} active bots`);
  } catch (error) {
    console.error('Failed to load bots:', error);
  }
}

// 定期检查过期的授权
setInterval(async () => {
  try {
    await pool.query(
      `UPDATE bots 
       SET status = 'expired' 
       WHERE expiry_date < NOW() AND status = 'active'`
    );
  } catch (error) {
    console.error('Failed to check expired bots:', error);
  }
}, 60000); // 每分钟检查一次

// 启动服务
loadActiveBots();

// 优雅关闭
process.once('SIGINT', () => {
  activeBots.forEach((bot) => bot.stop('SIGINT'));
  process.exit(0);
});

process.once('SIGTERM', () => {
  activeBots.forEach((bot) => bot.stop('SIGTERM'));
  process.exit(0);
});
```

### 4. 使用 PM2 启动 Bot 服务

```bash
pm2 start src/bot-service.js --name telegram-bots
pm2 save
```

---

## 前端部署

### 1. 配置前端 API 地址

在前端项目根目录创建 `.env.production`：

```env
VITE_API_URL=https://api.yourdomain.com/api
VITE_WS_URL=wss://api.yourdomain.com
```

### 2. 构建前端

```bash
# 在前端项目目录
npm run build
```

### 3. 部署到服务器

```bash
# 复制构建文件到服务器
scp -r dist/* user@yourserver:/var/www/html/

# 或者使用 Git 部署
cd /var/www/html
git pull origin main
npm install
npm run build
```

### 4. 配置 Nginx 服务前端

```bash
sudo nano /etc/nginx/sites-available/telegram-frontend
```

内容：

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 启用 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

启用并重载：

```bash
sudo ln -s /etc/nginx/sites-available/telegram-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. 配置 SSL (可选但推荐)

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

---

## 使用 Docker 一键部署

### 1. 创建 Docker Compose 配置

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: telegram_bot_manager
      POSTGRES_USER: bot_admin
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - app_network

  api:
    build: ./backend-api
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: telegram_bot_manager
      DB_USER: bot_admin
      DB_PASSWORD: your_password
      JWT_SECRET: your_jwt_secret
      PORT: 3000
      FRONTEND_URL: http://localhost
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    networks:
      - app_network
    restart: unless-stopped

  bot-service:
    build: ./bot-service
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: telegram_bot_manager
      DB_USER: bot_admin
      DB_PASSWORD: your_password
    depends_on:
      - postgres
    networks:
      - app_network
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - api
    networks:
      - app_network

volumes:
  postgres_data:

networks:
  app_network:
    driver: bridge
```

### 2. 启动所有服务

```bash
docker-compose up -d
```

### 3. 查看日志

```bash
docker-compose logs -f
```

---

## 常见问题

### 1. 数据库连接失败

**问题**: API 无法连接到 PostgreSQL

**解决方案**:
- 检查数据库服务是否运行: `sudo systemctl status postgresql`
- 验证连接信息是否正确
- 确认防火墙允许连接: `sudo ufw allow 5432/tcp`

### 2. Bot 无法接收消息

**问题**: Telegram bot 不响应消息

**解决方案**:
- 检查 bot token 是否正确
- 确认 bot 服务正在运行: `pm2 status`
- 查看 bot 服务日志: `pm2 logs telegram-bots`
- 验证网络连接

### 3. WebSocket 连接失败

**问题**: 前端无法建立 WebSocket 连接

**解决方案**:
- 检查 Nginx WebSocket 配置
- 确认防火墙开放 WebSocket 端口
- 验证 SSL 证书（wss:// 需要 HTTPS）

### 4. 前端无法加载

**问题**: 访问网站显示 404 或空白页

**解决方案**:
- 检查 Nginx 配置中的 root 路径
- 验证构建文件是否正确部署
- 查看浏览器控制台错误信息
- 检查 Nginx 错误日志: `sudo tail -f /var/log/nginx/error.log`

### 5. PM2 进程崩溃

**问题**: PM2 管理的进程频繁重启

**解决方案**:
- 查看详细日志: `pm2 logs <app-name> --lines 100`
- 检查系统资源: `htop`
- 增加内存限制: `pm2 start app.js --max-memory-restart 1G`

---

## 维护和监控

### 日常维护

```bash
# 查看所有 PM2 进程
pm2 status

# 重启服务
pm2 restart telegram-api
pm2 restart telegram-bots

# 查看日志
pm2 logs --lines 50

# 监控资源使用
pm2 monit

# 数据库备份
pg_dump -U bot_admin telegram_bot_manager > backup_$(date +%Y%m%d).sql
```

### 性能优化

1. **数据库优化**:
   - 定期清理旧消息
   - 添加必要的索引
   - 调整 PostgreSQL 配置

2. **API 优化**:
   - 使用 Redis 缓存
   - 实施连接池
   - 启用 gzip 压缩

3. **Bot 服务优化**:
   - 限制并发 bot 数量
   - 实施消息队列
   - 监控内存使用

---

## 安全建议

1. **更改默认密码**: 立即修改管理员密码
2. **启用 HTTPS**: 使用 Let's Encrypt 免费 SSL
3. **防火墙配置**: 只开放必要的端口
4. **定期更新**: 保持系统和依赖包更新
5. **日志监控**: 设置日志轮转和监控
6. **备份策略**: 定期备份数据库

---

## 支持和文档

如需更多帮助，请查看：
- 项目 README
- API 文档
- Telegram Bot API 文档

---

**部署完成！** 🎉

您的 Telegram 机器人管理系统现已上线运行。
