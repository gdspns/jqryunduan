# Telegram Bot Management System - 一键安装指南

## 🚀 快速安装（推荐）

### 方式一：一键安装脚本（最简单）

只需要一个域名和服务器即可完成全部安装！

```bash
# 1. 下载安装脚本
curl -O https://raw.githubusercontent.com/your-repo/telegram-bot-system/main/install.sh
chmod +x install.sh

# 2. 运行安装脚本
sudo ./install.sh
```

**安装过程中需要输入：**
- 您的域名（例如：example.com）
- 您的邮箱（用于 SSL 证书申请）

**就这么简单！** 脚本会自动：
- ✅ 安装并配置 Docker
- ✅ 创建数据库并初始化表结构
- ✅ 部署前端、后端、机器人服务
- ✅ 配置 Nginx 反向代理
- ✅ 申请免费 SSL 证书（Let's Encrypt）
- ✅ 启动所有服务

### 方式二：Docker Compose（手动配置）

如果您想自定义配置，可以使用 Docker Compose：

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/telegram-bot-system.git
cd telegram-bot-system

# 2. 复制并编辑环境变量
cp .env.example .env
nano .env  # 编辑配置

# 3. 启动服务
docker-compose up -d

# 4. 查看服务状态
docker-compose ps
```

## 📋 系统要求

### 最低配置
- **CPU**: 1核
- **内存**: 2GB
- **存储**: 20GB
- **操作系统**: Ubuntu 20.04+ / Debian 11+ / CentOS 7+
- **网络**: 公网 IP + 域名

### 推荐配置
- **CPU**: 2核+
- **内存**: 4GB+
- **存储**: 50GB+

## 🔧 安装前准备

### 1. 准备域名
- 购买一个域名（任何域名注册商）
- 将域名 DNS 解析到您的服务器 IP
- 添加 A 记录：`@` 和 `www` 都指向服务器 IP

### 2. 准备服务器
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要工具
sudo apt install -y curl wget git

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker
```

## 🎯 详细安装步骤

### 步骤 1: 下载项目

```bash
# 创建安装目录
mkdir -p /opt/telegram-bot-system
cd /opt/telegram-bot-system

# 下载安装脚本
curl -O https://raw.githubusercontent.com/your-repo/telegram-bot-system/main/install.sh
chmod +x install.sh
```

### 步骤 2: 运行安装

```bash
sudo ./install.sh
```

安装过程中会提示输入：

**域名示例：**
```
请输入您的域名 (例如: example.com): mybot.com
```

**邮箱示例：**
```
请输入您的邮箱 (用于 SSL 证书): admin@mybot.com
```

### 步骤 3: 等待安装完成

安装过程大约需要 5-10 分钟，脚本会显示进度：

```
🔍 检查依赖...
✅ Docker 已安装
📝 请输入配置信息：
✅ 配置文件已生成
📦 正在下载项目文件...
⚙️ 正在启动服务...
🔒 配置 SSL 证书...
✅ 安装完成！
```

### 步骤 4: 访问系统

安装完成后，访问您的域名：

```
https://yourdomain.com
```

**默认管理员账号：**
- 用户名: `admin`
- 密码: `qqai18301`

## 📱 使用流程

### 1. 用户试用（无需登录）
1. 访问首页
2. 在"免费试用"窗口填写：
   - 机器人令牌（Bot Token）
   - 开发者个人 ID
   - 自动欢迎语（可选）
3. 点击"开始试用"
4. 在聊天窗口测试功能（20条免费消息）

### 2. 管理员授权管理
1. 点击"管理员登录"
2. 使用管理员账号登录
3. 在后台可以：
   - 查看所有机器人授权状态
   - 添加新的机器人授权
   - 设置授权有效期
   - 生成激活链接
   - 启动/停止/删除机器人

### 3. 用户激活授权
1. 管理员在后台添加授权后生成激活链接
2. 用户访问激活链接
3. 输入机器人令牌 ID 验证
4. 激活成功后可以无限制使用

## 🔒 安全建议

### 必做事项：

1. **修改默认密码**
```bash
# 登录后在管理后台修改管理员密码
```

2. **配置防火墙**
```bash
# 只开放必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

3. **定期备份数据**
```bash
# 备份数据库
docker exec telegram-bot-db pg_dump -U admin telegram_bot_system > backup_$(date +%Y%m%d).sql

# 备份配置文件
tar -czf config_backup_$(date +%Y%m%d).tar.gz /opt/telegram-bot-system/.env
```

4. **SSL 证书自动续期**
```bash
# 证书会自动续期，但可以手动测试
docker-compose run --rm certbot renew --dry-run
```

## 🛠️ 管理命令

### 查看服务状态
```bash
cd /opt/telegram-bot-system
docker-compose ps
```

### 查看服务日志
```bash
# 查看所有日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f api
docker-compose logs -f bot-service
docker-compose logs -f frontend
```

### 重启服务
```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart api
docker-compose restart bot-service
```

### 停止服务
```bash
docker-compose down
```

### 启动服务
```bash
docker-compose up -d
```

### 更新系统
```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

## 🐛 常见问题

### 1. 域名无法访问

**检查 DNS 解析：**
```bash
nslookup yourdomain.com
```

**检查防火墙：**
```bash
sudo ufw status
```

### 2. SSL 证书申请失败

**原因：**
- 域名 DNS 未生效（需要等待）
- 80 端口被占用
- 域名指向错误

**解决：**
```bash
# 检查 80 端口
sudo netstat -tulpn | grep :80

# 重新申请证书
docker-compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot --email your@email.com --agree-tos --no-eff-email -d yourdomain.com -d www.yourdomain.com
```

### 3. 机器人无法接收消息

**检查机器人服务：**
```bash
docker-compose logs -f bot-service
```

**确保：**
- 机器人令牌正确
- 机器人已启动（/start）
- 数据库连接正常

### 4. 数据库连接失败

**检查数据库：**
```bash
docker-compose logs -f postgres

# 测试连接
docker exec -it telegram-bot-db psql -U admin -d telegram_bot_system
```

### 5. 服务启动失败

**查看详细错误：**
```bash
docker-compose logs

# 检查 Docker 资源
docker system df
docker system prune  # 清理无用资源
```

## 📊 性能优化

### 1. 数据库优化
```sql
-- 连接到数据库
docker exec -it telegram-bot-db psql -U admin -d telegram_bot_system

-- 创建索引（如果没有）
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_bots_is_active ON bots(is_active);

-- 清理旧消息（保留最近 30 天）
DELETE FROM messages WHERE created_at < NOW() - INTERVAL '30 days';

-- 优化数据库
VACUUM ANALYZE;
```

### 2. 增加资源限制
编辑 `docker-compose.yml`：
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

### 3. 启用 Redis 缓存（可选）
```yaml
services:
  redis:
    image: redis:alpine
    networks:
      - bot-network
```

## 🆘 获取帮助

### 查看日志
```bash
# 实时查看所有日志
docker-compose logs -f

# 查看最近 100 行
docker-compose logs --tail=100

# 查看特定时间段
docker-compose logs --since 2023-01-01 --until 2023-01-02
```

### 系统信息
```bash
# Docker 版本
docker --version
docker-compose --version

# 系统资源
free -h
df -h
```

### 联系支持
如果遇到问题，请提供：
1. 错误日志（`docker-compose logs`）
2. 系统信息（`uname -a`）
3. Docker 版本
4. 详细的错误描述

## 🎉 恭喜！

您已成功安装 Telegram Bot Management System！

**下一步：**
1. ✅ 登录管理后台
2. ✅ 修改默认密码
3. ✅ 添加您的第一个机器人
4. ✅ 测试聊天功能

享受使用吧！🚀
