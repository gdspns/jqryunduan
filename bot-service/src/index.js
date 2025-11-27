const BotManager = require('./bot-manager');
const pool = require('./db');
const WebSocket = require('ws');
require('dotenv').config();

const botManager = new BotManager();

// WebSocket 连接到后端 API 以接收指令
let wsConnection = null;

function connectToBackend() {
  const wsUrl = process.env.BACKEND_WS_URL || 'ws://localhost:3000/bot-service';
  
  try {
    wsConnection = new WebSocket(wsUrl);

    wsConnection.on('open', () => {
      console.log('✅ Connected to backend API');
    });

    wsConnection.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        await handleBackendMessage(message);
      } catch (error) {
        console.error('Error handling backend message:', error);
      }
    });

    wsConnection.on('close', () => {
      console.log('❌ Disconnected from backend API. Reconnecting in 5s...');
      setTimeout(connectToBackend, 5000);
    });

    wsConnection.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });
  } catch (error) {
    console.error('Failed to connect to backend:', error);
    setTimeout(connectToBackend, 5000);
  }
}

// 处理来自后端的消息
async function handleBackendMessage(message) {
  const { type, data } = message;

  switch (type) {
    case 'START_BOT':
      await botManager.startBot(data.bot_id, data.bot_token, data.config);
      break;
    
    case 'STOP_BOT':
      await botManager.stopBot(data.bot_id);
      break;
    
    case 'SEND_MESSAGE':
      await botManager.sendMessage(
        data.bot_id,
        data.telegram_user_id,
        data.message
      );
      break;
    
    case 'RELOAD_BOTS':
      await loadActiveBots();
      break;
    
    default:
      console.log('Unknown message type:', type);
  }
}

// 加载所有已授权且活跃的机器人
async function loadActiveBots() {
  try {
    const result = await pool.query(
      `SELECT id, bot_token, bot_name, developer_id, welcome_message 
       FROM bots 
       WHERE status = 'active' 
       AND is_authorized = true 
       AND (expiry_date IS NULL OR expiry_date > NOW())`
    );

    console.log(`📋 Loading ${result.rows.length} active bots...`);

    for (const bot of result.rows) {
      await botManager.startBot(bot.id, bot.bot_token, {
        bot_name: bot.bot_name,
        developer_id: bot.developer_id,
        welcome_message: bot.welcome_message,
      });
    }

    console.log('✅ All active bots loaded');
  } catch (error) {
    console.error('Failed to load bots:', error);
  }
}

// 定期检查过期的授权
async function checkExpiredAuthorizations() {
  try {
    const result = await pool.query(
      `UPDATE bots 
       SET status = 'expired', is_authorized = false
       WHERE expiry_date < NOW() 
       AND status = 'active'
       RETURNING id`
    );

    if (result.rows.length > 0) {
      console.log(`⏰ Expired ${result.rows.length} bot authorizations`);
      
      // 停止已过期的机器人
      for (const bot of result.rows) {
        await botManager.stopBot(bot.id);
      }
    }
  } catch (error) {
    console.error('Error checking expired authorizations:', error);
  }
}

// 定期检查试用限制
async function checkTrialLimits() {
  try {
    const result = await pool.query(
      `SELECT id, telegram_user_id, trial_messages_sent 
       FROM bot_users 
       WHERE is_authorized = false 
       AND trial_messages_sent >= 20 
       AND trial_expired_notified = false`
    );

    for (const user of result.rows) {
      // 标记为已通知
      await pool.query(
        `UPDATE bot_users 
         SET trial_expired_notified = true 
         WHERE id = $1`,
        [user.id]
      );
    }
  } catch (error) {
    console.error('Error checking trial limits:', error);
  }
}

// 发送消息到后端 API（通知有新消息）
function notifyBackend(data) {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify(data));
  }
}

// 设置 Bot Manager 的回调
botManager.on('message', async (botId, telegramUserId, message) => {
  try {
    // 检查用户是否超过试用限制
    const userResult = await pool.query(
      `SELECT trial_messages_sent, is_authorized 
       FROM bot_users 
       WHERE bot_id = $1 AND telegram_user_id = $2`,
      [botId, telegramUserId]
    );

    let messageCount = 0;
    let isAuthorized = false;

    if (userResult.rows.length > 0) {
      messageCount = userResult.rows[0].trial_messages_sent;
      isAuthorized = userResult.rows[0].is_authorized;
    }

    // 如果未授权且超过试用限制
    if (!isAuthorized && messageCount >= 20) {
      await botManager.sendMessage(
        botId,
        telegramUserId,
        '⚠️ 您的试用已结束（20条消息已用完）。请联系管理员激活授权以继续使用。'
      );
      return;
    }

    // 保存消息到数据库
    await pool.query(
      `INSERT INTO messages (bot_id, telegram_user_id, direction, content, created_at)
       VALUES ($1, $2, 'incoming', $3, NOW())`,
      [botId, telegramUserId, message.text || message.caption || '']
    );

    // 增加试用消息计数
    if (!isAuthorized) {
      await pool.query(
        `INSERT INTO bot_users (bot_id, telegram_user_id, telegram_username, trial_messages_sent)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (bot_id, telegram_user_id)
         DO UPDATE SET 
           trial_messages_sent = bot_users.trial_messages_sent + 1,
           telegram_username = EXCLUDED.telegram_username`,
        [botId, telegramUserId, message.from?.username || message.from?.first_name || '未知用户']
      );
    }

    // 通知后端有新消息
    notifyBackend({
      type: 'NEW_MESSAGE',
      data: {
        bot_id: botId,
        telegram_user_id: telegramUserId,
        telegram_username: message.from?.username || message.from?.first_name,
        message: message.text || message.caption || '',
        message_count: messageCount + 1,
      },
    });
  } catch (error) {
    console.error('Error handling incoming message:', error);
  }
});

botManager.on('started', (botId, botName) => {
  console.log(`✅ Bot started: ${botName} (${botId})`);
  notifyBackend({
    type: 'BOT_STARTED',
    data: { bot_id: botId, bot_name: botName },
  });
});

botManager.on('stopped', (botId) => {
  console.log(`⛔ Bot stopped: ${botId}`);
  notifyBackend({
    type: 'BOT_STOPPED',
    data: { bot_id: botId },
  });
});

botManager.on('error', (botId, error) => {
  console.error(`❌ Bot error (${botId}):`, error.message);
  notifyBackend({
    type: 'BOT_ERROR',
    data: { bot_id: botId, error: error.message },
  });
});

// 启动服务
async function startService() {
  console.log('🚀 Starting Telegram Bot Service...');
  
  // 连接到后端 API
  connectToBackend();
  
  // 加载所有活跃的机器人
  await loadActiveBots();
  
  // 定期检查过期授权（每分钟）
  setInterval(checkExpiredAuthorizations, 60000);
  
  // 定期检查试用限制（每30秒）
  setInterval(checkTrialLimits, 30000);
  
  console.log('✅ Telegram Bot Service is running');
  console.log(`📊 Active bots: ${botManager.getActiveBotCount()}`);
}

// 优雅关闭
process.once('SIGINT', () => {
  console.log('⚠️ Received SIGINT, shutting down gracefully...');
  botManager.stopAllBots();
  if (wsConnection) {
    wsConnection.close();
  }
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('⚠️ Received SIGTERM, shutting down gracefully...');
  botManager.stopAllBots();
  if (wsConnection) {
    wsConnection.close();
  }
  process.exit(0);
});

// 启动服务
startService().catch((error) => {
  console.error('Failed to start service:', error);
  process.exit(1);
});
