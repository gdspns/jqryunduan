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

    const { bot_id, telegram_user_id, content } = await req.json();
    console.log('Sending message:', { bot_id, telegram_user_id, content });

    if (!bot_id || !telegram_user_id || !content) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 获取机器人信息
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', bot_id)
      .single();

    if (botError || !bot) {
      // 尝试查找试用机器人
      const { data: trialBot, error: trialError } = await supabase
        .from('trial_bots')
        .select('*')
        .eq('id', bot_id)
        .single();

      if (trialError || !trialBot) {
        return new Response(JSON.stringify({ error: 'Bot not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 检查试用额度
      if (trialBot.message_count >= 20) {
        return new Response(JSON.stringify({ error: 'Trial limit reached' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 发送消息到 Telegram
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${trialBot.bot_token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegram_user_id,
            text: content,
          }),
        }
      );

      if (!telegramResponse.ok) {
        const error = await telegramResponse.json();
        console.error('Telegram API error:', error);
        return new Response(JSON.stringify({ error: 'Failed to send message to Telegram' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 保存消息到数据库
      await supabase.from('messages').insert({
        bot_id: trialBot.id,
        telegram_user_id,
        content,
        direction: 'outgoing',
      });

      // 更新消息计数
      await supabase
        .from('trial_bots')
        .update({ message_count: trialBot.message_count + 1 })
        .eq('id', trialBot.id);

      return new Response(JSON.stringify({ success: true, message_count: trialBot.message_count + 1 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 检查授权机器人状态
    if (bot.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Bot is not active' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 发送消息到 Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${bot.bot_token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegram_user_id,
          text: content,
        }),
      }
    );

    if (!telegramResponse.ok) {
      const error = await telegramResponse.json();
      console.error('Telegram API error:', error);
      return new Response(JSON.stringify({ error: 'Failed to send message to Telegram' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 保存消息到数据库
    const { error: msgError } = await supabase.from('messages').insert({
      bot_id: bot.id,
      telegram_user_id,
      content,
      direction: 'outgoing',
    });

    if (msgError) {
      console.error('Error saving message:', msgError);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});