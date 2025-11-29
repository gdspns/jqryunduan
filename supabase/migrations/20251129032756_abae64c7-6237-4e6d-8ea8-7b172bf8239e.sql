-- 添加激活码字段到 bots 表
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS activation_code text UNIQUE;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_bots_activation_code ON public.bots(activation_code);
CREATE INDEX IF NOT EXISTS idx_messages_bot_id ON public.messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_messages_telegram_user_id ON public.messages(telegram_user_id);

-- 添加 used_tokens 字段到 trial_bots 表，跟踪哪些令牌已经试用过
ALTER TABLE public.trial_bots ADD COLUMN IF NOT EXISTS used_tokens text[] DEFAULT '{}';

-- 为 messages 表启用实时功能
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 为 bots 表启用实时功能
ALTER PUBLICATION supabase_realtime ADD TABLE public.bots;

-- 创建函数生成随机激活码
CREATE OR REPLACE FUNCTION generate_activation_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 创建触发器自动生成激活码
CREATE OR REPLACE FUNCTION set_activation_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.activation_code IS NULL THEN
    NEW.activation_code := generate_activation_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_activation_code ON public.bots;
CREATE TRIGGER trigger_set_activation_code
  BEFORE INSERT ON public.bots
  FOR EACH ROW
  EXECUTE FUNCTION set_activation_code();