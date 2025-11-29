import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('Received webhook:', JSON.stringify(body, null, 2));

    // Telegram webhook 格式
    if (body.message) {
      const message = body.message;
      const telegramUserId = message.from.id.toString();
      const text = message.text || '';
      const username = message.from.username || message.from.first_name || 'Unknown';

      // 从 URL 中获取 bot_token (webhook 路径包含 bot token)
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const botToken = pathParts[pathParts.length - 1];

      console.log('Processing message from user:', telegramUserId, 'for bot:', botToken);

      // 查找对应的机器人
      const { data: bot, error: botError } = await supabase
        .from('bots')
        .select('*')
        .eq('bot_token', botToken)
        .maybeSingle();

      if (botError) {
        console.error('Error finding bot:', botError);
        return new Response(JSON.stringify({ error: 'Bot lookup failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!bot) {
        // 检查是否是试用机器人
        const { data: trialBot, error: trialError } = await supabase
          .from('trial_bots')
          .select('*')
          .eq('bot_token', botToken)
          .maybeSingle();

        if (trialError || !trialBot) {
          console.log('Bot not found:', botToken);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 处理试用机器人消息
        if (trialBot.message_count >= 20) {
          // 试用额度已用完
          await sendTelegramMessage(botToken, telegramUserId, '试用已结束，请联系管理员激活授权。');
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 发送试用消息到 messages 表（使用特殊的 bot_id）
        const { error: msgError } = await supabase
          .from('messages')
          .insert({
            bot_id: trialBot.id,
            telegram_user_id: telegramUserId,
            content: text,
            direction: 'incoming',
          });

        if (msgError) {
          console.error('Error saving trial message:', msgError);
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 检查机器人状态和授权
      if (bot.status !== 'active') {
        await sendTelegramMessage(botToken, telegramUserId, '该机器人当前不可用。');
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 保存消息到数据库
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          bot_id: bot.id,
          telegram_user_id: telegramUserId,
          content: text,
          direction: 'incoming',
        });

      if (msgError) {
        console.error('Error saving message:', msgError);
      } else {
        console.log('Message saved successfully');
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });
    const data = await response.json();
    console.log('Telegram API response:', data);
    return data;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
}