const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'telegram_bot_manager',
  user: process.env.DB_USER || 'bot_admin',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 测试数据库连接
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
  process.exit(-1);
});

// 初始化数据库表（如果需要）
async function initDatabase() {
  try {
    // 检查 bot_users 表是否存在，不存在则创建
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id UUID NOT NULL,
        telegram_user_id VARCHAR(50) NOT NULL,
        telegram_username VARCHAR(100),
        trial_messages_sent INT DEFAULT 0,
        is_authorized BOOLEAN DEFAULT FALSE,
        trial_expired_notified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bot_id, telegram_user_id)
      );
    `);

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// 启动时初始化
initDatabase();

module.exports = pool;
