const { Telegraf } = require('telegraf');
const EventEmitter = require('events');

class BotManager extends EventEmitter {
  constructor() {
    super();
    this.bots = new Map(); // bot_id -> { instance, config, userContexts }
  }

  /**
   * 启动一个机器人
   */
  async startBot(botId, botToken, config = {}) {
    // 如果已经在运行，先停止
    if (this.bots.has(botId)) {
      await this.stopBot(botId);
    }

    try {
      const bot = new Telegraf(botToken);
      
      // 存储每个用户的上下文（用于消息路由）
      const userContexts = new Map(); // telegram_user_id -> last_message_time

      // 欢迎消息处理
      bot.start(async (ctx) => {
        const userId = ctx.from.id.toString();
        userContexts.set(userId, Date.now());
        
        const welcomeMsg = config.welcome_message || 
          '👋 欢迎使用！您正在试用模式（20条免费消息）。';
        
        await ctx.reply(welcomeMsg);
      });

      // 处理所有文本消息
      bot.on('text', async (ctx) => {
        const userId = ctx.from.id.toString();
        userContexts.set(userId, Date.now());
        
        // 触发消息事件，交给主服务处理
        this.emit('message', botId, userId, ctx.message);
      });

      // 处理图片消息
      bot.on('photo', async (ctx) => {
        const userId = ctx.from.id.toString();
        userContexts.set(userId, Date.now());
        
        this.emit('message', botId, userId, {
          ...ctx.message,
          text: ctx.message.caption || '[图片]',
        });
      });

      // 处理其他类型消息
      bot.on('document', async (ctx) => {
        const userId = ctx.from.id.toString();
        userContexts.set(userId, Date.now());
        
        this.emit('message', botId, userId, {
          ...ctx.message,
          text: '[文件]',
        });
      });

      // 错误处理
      bot.catch((error, ctx) => {
        console.error(`Bot error (${botId}):`, error);
        this.emit('error', botId, error);
      });

      // 启动机器人
      await bot.launch();

      // 保存实例
      this.bots.set(botId, {
        instance: bot,
        token: botToken,
        config,
        userContexts,
        startedAt: new Date(),
      });

      this.emit('started', botId, config.bot_name || botToken.split(':')[0]);
    } catch (error) {
      console.error(`Failed to start bot ${botId}:`, error);
      this.emit('error', botId, error);
      throw error;
    }
  }

  /**
   * 停止一个机器人
   */
  async stopBot(botId) {
    const botData = this.bots.get(botId);
    if (!botData) {
      return;
    }

    try {
      await botData.instance.stop();
      this.bots.delete(botId);
      this.emit('stopped', botId);
    } catch (error) {
      console.error(`Failed to stop bot ${botId}:`, error);
      this.emit('error', botId, error);
    }
  }

  /**
   * 停止所有机器人
   */
  async stopAllBots() {
    const stopPromises = [];
    for (const [botId] of this.bots) {
      stopPromises.push(this.stopBot(botId));
    }
    await Promise.all(stopPromises);
  }

  /**
   * 发送消息给特定用户
   * 关键：实现消息路由隔离 - 确保消息只发给对应的用户
   */
  async sendMessage(botId, telegramUserId, message) {
    const botData = this.bots.get(botId);
    if (!botData) {
      throw new Error(`Bot ${botId} not found or not running`);
    }

    try {
      // 使用 Telegram Bot API 直接发送给特定用户
      await botData.instance.telegram.sendMessage(telegramUserId, message);
      
      // 更新用户上下文
      botData.userContexts.set(telegramUserId, Date.now());
      
      return true;
    } catch (error) {
      console.error(`Failed to send message (bot: ${botId}, user: ${telegramUserId}):`, error);
      throw error;
    }
  }

  /**
   * 获取机器人信息
   */
  getBotInfo(botId) {
    const botData = this.bots.get(botId);
    if (!botData) {
      return null;
    }

    return {
      bot_id: botId,
      config: botData.config,
      started_at: botData.startedAt,
      active_users: botData.userContexts.size,
      is_running: true,
    };
  }

  /**
   * 获取活跃机器人数量
   */
  getActiveBotCount() {
    return this.bots.size;
  }

  /**
   * 获取所有活跃机器人
   */
  getAllActiveBots() {
    const bots = [];
    for (const [botId, botData] of this.bots) {
      bots.push({
        bot_id: botId,
        bot_name: botData.config.bot_name,
        started_at: botData.startedAt,
        active_users: botData.userContexts.size,
      });
    }
    return bots;
  }

  /**
   * 检查机器人是否在运行
   */
  isBotRunning(botId) {
    return this.bots.has(botId);
  }

  /**
   * 清理不活跃的用户上下文（超过24小时未活动）
   */
  cleanupInactiveUsers() {
    const now = Date.now();
    const INACTIVE_THRESHOLD = 24 * 60 * 60 * 1000; // 24小时

    for (const [botId, botData] of this.bots) {
      for (const [userId, lastActive] of botData.userContexts) {
        if (now - lastActive > INACTIVE_THRESHOLD) {
          botData.userContexts.delete(userId);
        }
      }
    }
  }
}

module.exports = BotManager;
