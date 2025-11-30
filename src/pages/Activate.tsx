import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Bot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Activate = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [botToken, setBotToken] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [isActivated, setIsActivated] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActivating(true);

    try {
      // 查找具有此激活码的机器人
      const { data: bot, error: findError } = await supabase
        .from('bots')
        .select('*')
        .eq('activation_code', code)
        .maybeSingle();

      if (findError) throw findError;

      if (!bot) {
        throw new Error('激活码无效');
      }

      // 验证机器人令牌是否匹配
      if (bot.bot_token !== botToken) {
        throw new Error('机器人令牌不匹配');
      }

      // 激活机器人
      const { error: updateError } = await supabase
        .from('bots')
        .update({ status: 'active' })
        .eq('id', bot.id);

      if (updateError) throw updateError;

      setIsActivated(true);
      toast({
        title: '激活成功',
        description: '您的机器人已成功激活',
      });

      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      toast({
        title: '激活失败',
        description: error.message || '激活码无效或令牌不匹配',
        variant: 'destructive',
      });
    } finally {
      setIsActivating(false);
    }
  };

  if (isActivated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-telegram-bg via-background to-telegram-bg p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-12 pb-8">
            <div className="mx-auto w-20 h-20 bg-telegram-green/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-12 h-12 text-telegram-green" />
            </div>
            <CardTitle className="text-2xl mb-4">激活成功！</CardTitle>
            <CardDescription>
              您的机器人已成功激活，即将跳转到登录页面...
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-telegram-bg via-background to-telegram-bg p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <Bot className="w-10 h-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">激活您的机器人</CardTitle>
          <CardDescription>
            请输入您的机器人令牌以完成激活
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activation-code">激活码</Label>
              <Input
                id="activation-code"
                value={code}
                disabled
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bot-token">机器人令牌 (Bot Token)</Label>
              <Input
                id="bot-token"
                placeholder="123456:ABC-DEF..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                请输入管理员为您授权的机器人令牌
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isActivating}>
              {isActivating ? '激活中...' : '激活机器人'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Activate;