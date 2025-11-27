const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

console.log('Starting API server on port', PORT);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgresql:5432/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Pool error:', err);
});

app.use(cors());
app.use(express.json());

let dbReady = false;

async function ensureDB() {
  if (dbReady) return;
  let client;
  try {
    client = await pool.connect();
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS bots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        bot_token VARCHAR(255) UNIQUE NOT NULL,
        bot_name VARCHAR(100) NOT NULL,
        developer_id VARCHAR(50),
        welcome_message TEXT,
        status VARCHAR(20) DEFAULT 'active',
        trial_messages_sent INT DEFAULT 0,
        is_authorized BOOLEAN DEFAULT FALSE,
        expiry_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS activation_links (
        id SERIAL PRIMARY KEY,
        bot_token VARCHAR(255) UNIQUE NOT NULL,
        activation_code VARCHAR(100) UNIQUE NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        expiry_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
        telegram_user_id VARCHAR(50) NOT NULL,
        telegram_username VARCHAR(100),
        direction VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    dbReady = true;
    console.log('Database tables ready');
    client.release();
  } catch (error) {
    console.error('DB error:', error.message);
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: dbReady });
});

app.post('/api/auth/register', async (req, res) => {
  let client;
  try {
    await ensureDB();
    const { username, password, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    client = await pool.connect();
    const check = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (check.rows.length > 0) {
      client.release();
      return res.status(400).json({ error: 'User already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await client.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, hash, email || null]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);

    client.release();
    res.json({ token, user });
  } catch (error) {
    if (client) client.release();
    console.error('Register error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  let client;
  try {
    await ensureDB();
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    client = await pool.connect();
    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      client.release();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      client.release();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);

    client.release();
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    if (client) client.release();
    console.error('Login error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  let client;
  try {
    await ensureDB();
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    client = await pool.connect();
    const result = await client.query('SELECT id, username, email FROM users WHERE id = $1', [decoded.id]);
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (client) client.release();
    console.error('Get user error:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
  ensureDB().catch(err => console.error('Background DB init failed:', err));
});
