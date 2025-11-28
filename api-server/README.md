# Telegram Bot API 服务器

这是连接前端和bot-service的中间API服务器。

## 功能

- 处理试用机器人的创建和消息发送
- 用户认证和授权
- 机器人管理
- 管理员后台功能
- WebSocket通信（前端 ↔ API服务器 ↔ bot-service）

## 安装

```bash
cd api-server
npm install
```

## 配置

1. 复制 `.env.example` 为 `.env`
2. 修改数据库连接信息
3. 修改 JWT_SECRET

```bash
cp .env.example .env
```

## 运行

开发模式（自动重启）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

或使用 pm2：
```bash
pm2 start src/index.js --name telegram-api
```

## API端点

### 试用相关
- `POST /api/bots/trial` - 开始试用
- `POST /api/bots/trial/message` - 发送试用消息

### 用户认证
- `POST /api/auth/login` - 用户登录

### 机器人管理（需要认证）
- `GET /api/bots` - 获取用户的机器人列表
- `POST /api/bots` - 添加机器人

### 管理员功能（需要管理员权限）
- `GET /api/admin/bots` - 获取所有机器人
- `POST /api/admin/bots/:id/authorize` - 授权机器人
- `POST /api/admin/bots/:id/toggle` - 启动/停止机器人
- `DELETE /api/admin/bots/:id` - 删除机器人

### 健康检查
- `GET /health` - 检查服务状态

## WebSocket

- 前端连接: `ws://localhost:3000/ws`
- bot-service连接: 配置在 `BOT_SERVICE_WS_URL`

## 默认管理员账号

- 用户名: `admin`
- 密码: `qqai18301`

## 数据库表结构

### users - 用户表
- id: 主键
- username: 用户名
- password: 密码（加密）
- role: 角色（user/admin）
- created_at: 创建时间

### trial_bots - 试用机器人表
- id: 主键
- bot_id: 机器人唯一ID
- bot_token: 机器人令牌
- developer_id: 开发者ID
- welcome_message: 欢迎消息
- message_count: 消息计数
- created_at: 创建时间

### bots - 机器人表
- id: 主键
- user_id: 用户ID
- bot_token: 机器人令牌
- developer_id: 开发者ID
- welcome_message: 欢迎消息
- status: 状态（active/inactive）
- expires_at: 过期时间
- created_at: 创建时间

### messages - 消息记录表
- id: 主键
- bot_id: 机器人ID
- telegram_user_id: Telegram用户ID
- message: 消息内容
- direction: 方向（in/out）
- created_at: 创建时间
