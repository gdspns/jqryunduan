import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Bot, LogOut, Plus, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface BotData {
  id: string;
  bot_token: string;
  bot_name: string;
  welcome_message: string;
  status: string;
  developer_id: string;
  expires_at: string | null;
  activation_code: string | null;
  created_at: string;
}

const Dashboard = () => {
  const [bots, setBots] = useState<BotData[]>([]);
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [newBot, setNewBot] = useState({
    botToken: '',
    botName: '',
    developerId: '',
    welcomeMessage: '您好！欢迎使用我们的服务。',
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (user) {
      loadBots();
    }
  }, [user]);

  const loadBots = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBots(data || []);
    } catch (error: any) {
      toast({
        title: '加载失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsAddingBot(true);

    try {
      const { error } = await supabase
        .from('bots')
        .insert({
          bot_token: newBot.botToken,
          bot_name: newBot.botName,
          developer_id: newBot.developerId,
          welcome_message: newBot.welcomeMessage,
          user_id: user.id,
          status: 'inactive',
        });

      if (error) throw error;

      toast({
        title: '添加成功',
        description: '机器人已添加，请等待管理员激活授权。',
      });

      setNewBot({
        botToken: '',
        botName: '',
        developerId: '',
        welcomeMessage: '您好！欢迎使用我们的服务。',
      });

      loadBots();
    } catch (error: any) {
      toast({
        title: '添加失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsAddingBot(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getStatusBadge = (bot: BotData) => {
    if (bot.status === 'active') {
      return <Badge className="bg-telegram-green">已授权</Badge>;
    }
    if (bot.status === 'expired') {
      return <Badge variant="destructive">已过期</Badge>;
    }
    return <Badge variant="outline">待激活</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">我的机器人</h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="w-5 h-5 mr-2" />
                添加机器人
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>添加新机器人</DialogTitle>
                <DialogDescription>
                  配置您的 Telegram 机器人信息
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddBot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="botToken">机器人令牌 (Bot Token)</Label>
                  <Input
                    id="botToken"
                    placeholder="123456:ABC-DEF..."
                    value={newBot.botToken}
                    onChange={(e) => setNewBot({ ...newBot, botToken: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="botName">机器人名称</Label>
                  <Input
                    id="botName"
                    placeholder="我的机器人"
                    value={newBot.botName}
                    onChange={(e) => setNewBot({ ...newBot, botName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="developerId">开发者个人ID</Label>
                  <Input
                    id="developerId"
                    placeholder="123456789"
                    value={newBot.developerId}
                    onChange={(e) => setNewBot({ ...newBot, developerId: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">自动欢迎语</Label>
                  <Textarea
                    id="welcomeMessage"
                    placeholder="输入欢迎消息..."
                    value={newBot.welcomeMessage}
                    onChange={(e) => setNewBot({ ...newBot, welcomeMessage: e.target.value })}
                    rows={4}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isAddingBot}>
                  {isAddingBot ? '添加中...' : '添加机器人'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <Card key={bot.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Bot className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{bot.bot_name}</CardTitle>
                      <CardDescription className="text-xs">
                        创建于 {new Date(bot.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(bot)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">欢迎语:</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{bot.welcome_message}</p>
                </div>
                {bot.activation_code && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">激活码:</p>
                    <p className="text-sm font-mono bg-muted p-3 rounded-lg">{bot.activation_code}</p>
                  </div>
                )}
                {bot.expires_at && (
                  <div className="text-xs text-muted-foreground">
                    有效期至: {new Date(bot.expires_at).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {bots.length === 0 && (
          <Card className="text-center py-16">
            <CardContent>
              <Bot className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <CardTitle className="mb-2">还没有机器人</CardTitle>
              <CardDescription>点击"添加机器人"按钮开始使用</CardDescription>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Dashboard;