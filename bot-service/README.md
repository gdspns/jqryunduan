# Telegram Bot 独立服务

这是一个独立运行的 Telegram 机器人服务，实现多机器人管理、消息路由、试用机制等功能。

## 核心特性

✅ **多机器人支持** - 同时管理多个 Telegram 机器人
✅ **消息路由隔离** - 确保每个用户的消息准确送达，互不干扰
✅ **试用机制** - 新用户可免费试用 20 条消息
✅ **7x24 小时运行** - 独立后台服务，不依赖网站状态
✅ **自动授权检查** - 自动检测并停止过期的机器人
✅ **实时通信** - 通过 WebSocket 与后端 API 实时通信

## 安装

```bash
cd bot-service
npm install
```

## 配置

1. 复制环境变量示例文件：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入您的数据库配置：
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telegram_bot_manager
DB_USER=bot_admin
DB_PASSWORD=your_password_here
BACKEND_WS_URL=ws://localhost:3000/bot-service
```

## 运行

### 开发模式
```bash
npm run dev
```

### 生产模式（使用 PM2）
```bash
# 启动服务
npm run pm2:start

# 查看日志
npm run pm2:logs

# 重启服务
npm run pm2:restart

# 停止服务
npm run pm2:stop
```

### 直接运行
```bash
npm start
```

## 架构说明

### 1. 核心组件

- **index.js**: 主服务文件，负责启动服务、加载机器人、定期检查
- **bot-manager.js**: 机器人管理器，负责启动/停止机器人、消息路由
- **db.js**: 数据库连接池

### 2. 消息路由机制

```
用户 A → Telegram Bot → Bot Service → 数据库 → 后端 API → 网站控制台（用户 A）
                                                              ↓
用户 B → Telegram Bot → Bot Service → 数据库 → 后端 API → 网站控制台（用户 B）
```

**关键点**：
- 每个用户的消息都有唯一的 `telegram_user_id` 标识
- Bot Service 记录每个用户的上下文（`userContexts`）
- 发送消息时，使用 `telegram.sendMessage(telegramUserId, message)` 确保只发给对应用户
- 数据库存储所有消息记录，包括方向（incoming/outgoing）

### 3. 试用机制

- 新用户首次使用时，在 `bot_users` 表中创建记录
- 每发送一条消息，`trial_messages_sent` 计数器 +1
- 达到 20 条后，自动回复试用结束提示
- 管理员可在后台激活授权，设置 `is_authorized = true`

### 4. 自动授权检查

服务会定期（每分钟）检查：
- 授权是否过期（`expiry_date < NOW()`）
- 自动停止过期的机器人
- 更新数据库状态

## 与后端 API 通信

Bot Service 通过 WebSocket 与后端 API 保持连接，支持以下消息类型：

### 接收的消息（从后端 API）

```javascript
// 启动机器人
{
  type: 'START_BOT',
  data: {
    bot_id: 'uuid',
    bot_token: 'bot_token',
    config: {
      bot_name: 'name',
      developer_id: 'id',
      welcome_message: 'message'
    }
  }
}

// 停止机器人
{
  type: 'STOP_BOT',
  data: { bot_id: 'uuid' }
}

// 发送消息给用户
{
  type: 'SEND_MESSAGE',
  data: {
    bot_id: 'uuid',
    telegram_user_id: '123456',
    message: 'Hello'
  }
}

// 重新加载所有机器人
{
  type: 'RELOAD_BOTS'
}
```

### 发送的消息（到后端 API）

```javascript
// 新消息通知
{
  type: 'NEW_MESSAGE',
  data: {
    bot_id: 'uuid',
    telegram_user_id: '123456',
    telegram_username: 'username',
    message: 'message content',
    message_count: 5
  }
}

// 机器人启动通知
{
  type: 'BOT_STARTED',
  data: { bot_id: 'uuid', bot_name: 'name' }
}

// 机器人停止通知
{
  type: 'BOT_STOPPED',
  data: { bot_id: 'uuid' }
}

// 错误通知
{
  type: 'BOT_ERROR',
  data: { bot_id: 'uuid', error: 'error message' }
}
```

## 数据库表结构

### bots 表
```sql
id UUID PRIMARY KEY
user_id UUID (关联用户)
bot_token VARCHAR(255) (机器人令牌)
bot_name VARCHAR(100)
developer_id VARCHAR(50)
welcome_message TEXT
status VARCHAR(20) (active/inactive/expired)
trial_messages_sent INT (试用消息数)
is_authorized BOOLEAN (是否已授权)
expiry_date TIMESTAMP (授权过期日期)
created_at TIMESTAMP
```

### bot_users 表
```sql
id UUID PRIMARY KEY
bot_id UUID (关联机器人)
telegram_user_id VARCHAR(50) (Telegram 用户 ID)
telegram_username VARCHAR(100)
trial_messages_sent INT (该用户的试用消息数)
is_authorized BOOLEAN (该用户是否已授权)
trial_expired_notified BOOLEAN (是否已通知试用结束)
created_at TIMESTAMP
UNIQUE(bot_id, telegram_user_id)
```

### messages 表
```sql
id UUID PRIMARY KEY
bot_id UUID (关联机器人)
telegram_user_id VARCHAR(50)
telegram_username VARCHAR(100)
direction VARCHAR(20) (incoming/outgoing)
content TEXT
created_at TIMESTAMP
```

## 监控和维护

### 查看运行状态
```bash
pm2 status
pm2 monit
```

### 查看日志
```bash
pm2 logs telegram-bot-service
pm2 logs telegram-bot-service --lines 100
```

### 重启服务
```bash
pm2 restart telegram-bot-service
```

### 停止服务
```bash
pm2 stop telegram-bot-service
```

## 故障排查

### 1. 机器人无法启动
- 检查 bot token 是否正确
- 验证网络连接
- 查看日志：`pm2 logs telegram-bot-service`

### 2. 消息无法路由
- 确认数据库连接正常
- 检查 WebSocket 连接到后端 API
- 验证 `telegram_user_id` 是否正确存储

### 3. 授权检查不工作
- 确认定时任务正在运行
- 检查数据库 `expiry_date` 字段
- 查看服务日志

## 安全建议

1. **保护 Bot Token**: 永远不要将 token 提交到代码仓库
2. **使用环境变量**: 所有敏感信息都通过 `.env` 文件配置
3. **限制数据库访问**: 使用专门的数据库用户，只授予必要权限
4. **定期备份**: 定期备份数据库和配置文件
5. **监控日志**: 定期检查日志，及时发现异常

## 性能优化

1. **连接池**: 使用数据库连接池，避免频繁创建连接
2. **清理不活跃用户**: 定期清理超过 24 小时未活动的用户上下文
3. **批量操作**: 尽可能使用批量数据库操作
4. **缓存**: 对频繁访问的数据使用缓存（如 Redis）

## 扩展功能

可以根据需要添加：
- 消息队列（RabbitMQ / Redis）处理高并发
- 分布式部署，支持多个服务实例
- 更详细的统计和分析功能
- 自定义命令和回复规则
- 文件和媒体消息支持

## 支持

如有问题，请查看：
- 项目文档 DEPLOYMENT.md
- 日志文件
- Telegram Bot API 文档：https://core.telegram.org/bots/api
- Telegraf 文档：https://telegraf.js.org/
