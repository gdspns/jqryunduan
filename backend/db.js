const { Pool } = require('pg');
require('dotenv').config();

// 使用 DATABASE_URL 或分离的参数
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'postgresql'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'postgres'}`
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// 初始化数据库表
async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // 创建用户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Users table created');

    // 创建机器人表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        bot_token VARCHAR(255) UNIQUE NOT NULL,
        bot_name VARCHAR(100) NOT NULL,
        bot_username VARCHAR(100),
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Bots table created');

    // 创建消息表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
        telegram_user_id VARCHAR(50) NOT NULL,
        telegram_username VARCHAR(100),
        direction VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Messages table created');

    // 创建索引
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bots_bot_token ON bots(bot_token);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_bot_id ON messages(bot_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_telegram_user_id ON messages(telegram_user_id);
    `);
    console.log('✓ Indexes created');

    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

module.exports = { pool, initializeDatabase };
