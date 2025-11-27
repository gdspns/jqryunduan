const pool = require('./db');

const initDatabase = async () => {
  try {
    console.log('Initializing database...');

    // 创建用户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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

    // 创建授权表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS authorizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        permission_level VARCHAR(20) DEFAULT 'viewer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Authorizations table created');

    // 创建消息日志表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
        chat_id BIGINT NOT NULL,
        user_id BIGINT,
        message_text TEXT,
        message_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Message logs table created');

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
      CREATE INDEX IF NOT EXISTS idx_authorizations_bot_id ON authorizations(bot_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_authorizations_user_id ON authorizations(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_message_logs_bot_id ON message_logs(bot_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at);
    `);
    console.log('✓ Indexes created');

    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

module.exports = initDatabase;
