const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgresql:5432/postgres',
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

    // 创建索引
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    console.log('✓ Indexes created');

    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

module.exports = { pool, initializeDatabase };
