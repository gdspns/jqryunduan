const WebSocket = require('ws');
const http = require('http');
const BotManager = require('./bot-manager');
const db = require('./db');
require('dotenv').config();

const botManager = new BotManager();
const PORT = process.env.PORT || 3001;

// 创建HTTP服务器和WebSocket服务器
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// 存储连接的API服务器
let apiServerWs = null;

// 处理来自API服务器的WebSocket连接
wss.on('connection', (ws) => {
  console.log('API服务器已连接');
  apiServerWs = ws;

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('收到API服务器消息:', message);

      switch (message.type) {
        case 'start_trial_bot':
          await handleStartTrialBot(message.data);
          break;
        case 'send_trial_message':
          await handleSendTrialMessage(message.data);
          break;
        case 'start_bot':
          await handleStartBot(message.data);
          break;
        case 'stop_bot':
          await handleStopBot(message.data);
          break;
        default:
          console.log('未知消息类型:', message.type);
      }
    } catch (error) {
      console.error('处理消息失败:', error);
    }
  });

  ws.on('close', () => {
    console.log('API服务器连接断开');
    apiServerWs = null;
  });

  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

// 处理启动试用机器人
async function handleStartTrialBot(data) {
  const { bot_id, bot_token, developer_id, welcome_message } = data;
  
  try {
    await botManager.startBot(bot_id, bot_token, {
      developerId: developer_id,
      welcomeMessage: welcome_message,
      isTrial: true
    });

    // 发送欢迎消息
    if (welcome_message) {
      await botManager.sendMessage(bot_id, developer_id, welcome_message);
    }

    sendToApiServer({
      type: 'trial_bot_started',
      data: { bot_id, success: true }
    });
  } catch (error) {
    console.error('启动试用机器人失败:', error);
    sendToApiServer({
      type: 'trial_bot_error',
      data: { bot_id, error: error.message }
    });
  }
}

// 处理发送试用消息
async function handleSendTrialMessage(data) {
  const { bot_id, bot_token, developer_id, message } = data;
  
  try {
    await botManager.sendMessage(bot_id, developer_id, message);
    
    sendToApiServer({
      type: 'trial_message_sent',
      data: { bot_id, success: true }
    });
  } catch (error) {
    console.error('发送试用消息失败:', error);
    sendToApiServer({
      type: 'trial_message_error',
      data: { bot_id, error: error.message }
    });
  }
}

// 处理启动机器人
async function handleStartBot(data) {
  const { bot_id, bot_token, config } = data;
  
  try {
    await botManager.startBot(bot_id, bot_token, config);
    sendToApiServer({
      type: 'bot_started',
      data: { bot_id, success: true }
    });
  } catch (error) {
    console.error('启动机器人失败:', error);
  }
}

// 处理停止机器人
async function handleStopBot(data) {
  const { bot_id } = data;
  
  try {
    await botManager.stopBot(bot_id);
    sendToApiServer({
      type: 'bot_stopped',
      data: { bot_id, success: true }
    });
  } catch (error) {
    console.error('停止机器人失败:', error);
  }
}

// 发送消息到API服务器
function sendToApiServer(message) {
  if (apiServerWs && apiServerWs.readyState === WebSocket.OPEN) {
    apiServerWs.send(JSON.stringify(message));
  }
}

// 加载所有已授权的机器人
async function loadAndStartBots() {
  try {
    const result = await db.query(
      `SELECT * FROM bots 
       WHERE status = 'active' 
       AND (expires_at IS NULL OR expires_at > NOW())`
    );

    console.log(`加载 ${result.rows.length} 个已授权机器人...`);

    for (const bot of result.rows) {
      await botManager.startBot(bot.id, bot.bot_token, {
        developerId: bot.developer_id,
        welcomeMessage: bot.welcome_message,
      });
    }

    console.log('所有机器人已加载完成');
  } catch (error) {
    console.error('加载机器人失败:', error);
  }
}

// 定期检查过期的授权
setInterval(async () => {
  try {
    const result = await db.query(
      `UPDATE bots 
       SET status = 'expired' 
       WHERE expires_at < NOW() 
       AND status = 'active'
       RETURNING id`
    );

    if (result.rows.length > 0) {
      console.log(`过期 ${result.rows.length} 个机器人授权`);
      for (const bot of result.rows) {
        await botManager.stopBot(bot.id);
      }
    }
  } catch (error) {
    console.error('检查过期授权失败:', error);
  }
}, 60000); // 每分钟检查一次

// 启动服务
server.listen(PORT, () => {
  console.log(`Bot服务运行在端口 ${PORT}`);
  console.log('等待API服务器连接...');
  loadAndStartBots();
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到关闭信号，正在停止所有机器人...');
  botManager.stopAllBots();
  server.close();
  process.exit(0);
});
