#!/bin/bash

# Telegram Bot Management System - One-Click Installation Script
# 一键安装脚本

set -e

echo "================================================"
echo "  Telegram Bot Management System Installer"
echo "  Telegram 机器人管理系统一键安装"
echo "================================================"
echo ""

# 检测操作系统
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
else
    echo "❌ 不支持的操作系统"
    exit 1
fi

# 检查 Docker 和 Docker Compose
echo "🔍 检查依赖..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    echo "   访问: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose 未安装"
    exit 1
fi

echo "✅ Docker 已安装"

# 创建安装目录
INSTALL_DIR=$(pwd)/telegram-bot-system
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 生成随机密码
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

DB_PASSWORD=$(generate_password)
JWT_SECRET=$(generate_password)
ADMIN_PASSWORD="qqai18301"

echo ""
echo "📝 请输入配置信息："
echo ""

# 输入域名
read -p "请输入您的域名 (例如: example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "❌ 域名不能为空"
    exit 1
fi

# 输入邮箱（用于 SSL 证书）
read -p "请输入您的邮箱 (用于 SSL 证书): " EMAIL
if [ -z "$EMAIL" ]; then
    echo "❌ 邮箱不能为空"
    exit 1
fi

# 创建 docker-compose.yml
cat > docker-compose.yml <<EOF
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: telegram-bot-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: telegram_bot_system
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - bot-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    image: node:18-alpine
    container_name: telegram-bot-api
    restart: unless-stopped
    working_dir: /app
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://admin:${DB_PASSWORD}@postgres:5432/telegram_bot_system
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_USERNAME: admin
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
    volumes:
      - ./backend:/app
    command: sh -c "npm install && node src/index.js"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - bot-network
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  bot-service:
    image: node:18-alpine
    container_name: telegram-bot-service
    restart: unless-stopped
    working_dir: /app
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://admin:${DB_PASSWORD}@postgres:5432/telegram_bot_system
      API_URL: http://api:3000
    volumes:
      - ./bot-service:/app
    command: sh -c "npm install && node src/index.js"
    depends_on:
      postgres:
        condition: service_healthy
      api:
        condition: service_healthy
    networks:
      - bot-network

  frontend:
    image: nginx:alpine
    container_name: telegram-bot-frontend
    restart: unless-stopped
    volumes:
      - ./frontend/dist:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
    networks:
      - bot-network

  certbot:
    image: certbot/certbot
    container_name: telegram-bot-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait \$\${!}; done;'"

volumes:
  postgres_data:

networks:
  bot-network:
    driver: bridge
EOF

# 创建数据库初始化脚本
cat > init.sql <<'EOF'
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 机器人表
CREATE TABLE IF NOT EXISTS bots (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bot_token VARCHAR(255) UNIQUE NOT NULL,
    bot_username VARCHAR(255),
    developer_id VARCHAR(255) NOT NULL,
    welcome_message TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_trial BOOLEAN DEFAULT TRUE,
    trial_messages_sent INTEGER DEFAULT 0,
    expiry_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 激活链接表
CREATE TABLE IF NOT EXISTS activation_links (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
    activation_code VARCHAR(255) UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
    telegram_user_id VARCHAR(255) NOT NULL,
    telegram_username VARCHAR(255),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bots_token ON bots(bot_token);
CREATE INDEX IF NOT EXISTS idx_messages_bot_id ON messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_messages_telegram_user_id ON messages(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_activation_links_code ON activation_links(activation_code);

-- 插入管理员账户
INSERT INTO users (username, password, is_admin) 
VALUES ('admin', '$2b$10$rQZ9xKZ7LZxZ7Z7Z7Z7Z7uOQZ9xKZ7LZxZ7Z7Z7Z7Z7Z7Z7Z7Z7ZO', true)
ON CONFLICT (username) DO NOTHING;
EOF

# 创建 Nginx 配置
cat > nginx.conf <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    root /usr/share/nginx/html;
    index index.html;

    # 前端静态文件
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
EOF

# 创建环境变量文件
cat > .env <<EOF
# Database
DATABASE_URL=postgresql://admin:${DB_PASSWORD}@postgres:5432/telegram_bot_system

# API
JWT_SECRET=${JWT_SECRET}
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Domain
DOMAIN=${DOMAIN}
EMAIL=${EMAIL}
EOF

echo ""
echo "✅ 配置文件已生成"
echo ""
echo "📦 正在下载项目文件..."

# 这里应该从 Git 仓库克隆或下载项目文件
# 为了演示，我们创建占位目录
mkdir -p backend bot-service frontend/dist

echo ""
echo "⚙️ 正在启动服务..."
docker-compose up -d postgres

echo "⏳ 等待数据库启动..."
sleep 10

echo "🚀 启动所有服务..."
docker-compose up -d

echo ""
echo "🔒 配置 SSL 证书..."
docker-compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot --email $EMAIL --agree-tos --no-eff-email -d $DOMAIN -d www.$DOMAIN

echo ""
echo "♻️ 重启 Nginx..."
docker-compose restart frontend

echo ""
echo "================================================"
echo "  ✅ 安装完成！"
echo "================================================"
echo ""
echo "📊 系统信息："
echo "   域名: https://${DOMAIN}"
echo "   管理员账号: admin"
echo "   管理员密码: ${ADMIN_PASSWORD}"
echo ""
echo "📝 配置文件位置: ${INSTALL_DIR}/.env"
echo ""
echo "🔧 常用命令："
echo "   查看服务状态: docker-compose ps"
echo "   查看日志: docker-compose logs -f"
echo "   停止服务: docker-compose down"
echo "   重启服务: docker-compose restart"
echo ""
echo "⚠️ 重要提示："
echo "   1. 请妥善保管 .env 文件中的密码"
echo "   2. 首次访问请使用管理员账号登录"
echo "   3. 建议修改默认管理员密码"
echo ""
