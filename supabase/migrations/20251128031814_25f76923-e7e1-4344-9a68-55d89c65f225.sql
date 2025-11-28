-- 创建用户配置文件表
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 创建配置文件策略
CREATE POLICY "用户可以查看自己的配置文件"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "用户可以更新自己的配置文件"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 创建用户角色枚举
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 创建用户角色表
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- 启用 RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 创建角色检查函数（安全定义器）
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 创建用户角色策略
CREATE POLICY "管理员可以查看所有角色"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "管理员可以插入角色"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "管理员可以删除角色"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 创建试用机器人表
CREATE TABLE public.trial_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token TEXT NOT NULL,
  developer_id TEXT NOT NULL,
  welcome_message TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 试用机器人表不需要 RLS（公开试用）
ALTER TABLE public.trial_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "任何人都可以创建试用机器人"
  ON public.trial_bots FOR INSERT
  WITH CHECK (true);

CREATE POLICY "任何人都可以查看试用机器人"
  ON public.trial_bots FOR SELECT
  USING (true);

CREATE POLICY "任何人都可以更新试用机器人"
  ON public.trial_bots FOR UPDATE
  USING (true);

-- 创建机器人表
CREATE TABLE public.bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bot_token TEXT NOT NULL,
  bot_name TEXT,
  developer_id TEXT NOT NULL,
  welcome_message TEXT,
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

-- 创建机器人策略
CREATE POLICY "用户可以查看自己的机器人"
  ON public.bots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户可以插入自己的机器人"
  ON public.bots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以更新自己的机器人"
  ON public.bots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "用户可以删除自己的机器人"
  ON public.bots FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "管理员可以查看所有机器人"
  ON public.bots FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "管理员可以更新所有机器人"
  ON public.bots FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "管理员可以删除所有机器人"
  ON public.bots FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 创建消息表
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE NOT NULL,
  telegram_user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 创建消息策略
CREATE POLICY "用户可以查看自己机器人的消息"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bots
      WHERE bots.id = messages.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以插入自己机器人的消息"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bots
      WHERE bots.id = messages.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "管理员可以查看所有消息"
  ON public.messages FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 创建自动创建配置文件的触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 创建默认管理员角色（在第一个用户注册后手动添加）
-- 管理员需要在用户注册后手动运行：
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('<user_id>', 'admin');