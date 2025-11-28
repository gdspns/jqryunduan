import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, LogOut, Plus, Play, Square, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Bot {
  id: string;
  bot_token: string;
  bot_name: string | null;
  developer_id: string;
  status: string;
  expires_at: string | null;
  created_at: string;
}

const Admin = () => {
  const [bots, setBots] = useState<Bot[]>([]);
  const [newBot, setNewBot] = useState({
    botToken: '',
    botName: '',
    developerId: '',
    expiryDays: 30,
  });
  const [isAdding, setIsAdding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin, signOut } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (!isAdmin) {
      toast({
        title: '权限不足',
        description: '您没有管理员权限',
        variant: 'destructive',
      });
      navigate('/dashboard');
      return;
    }

    loadBots();
  }, [user, isAdmin]);

  const loadBots = async () => {
    try {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
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
    setIsAdding(true);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + newBot.expiryDays);

      const { error } = await supabase
        .from('bots')
        .insert({
          user_id: user!.id,
          bot_token: newBot.botToken,
          bot_name: newBot.botName || null,
          developer_id: newBot.developerId,
          status: 'active',
          expires_at: expiresAt.toISOString(),
        });

      if (error) throw error;

      toast({
        title: '添加成功',
        description: '机器人已添加并激活',
      });

      setNewBot({ botToken: '', botName: '', developerId: '', expiryDays: 30 });
      setDialogOpen(false);
      loadBots();
    } catch (error: any) {
      toast({
        title: '添加失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'active' | 'inactive') => {
    try {
      const { error } = await supabase
        .from('bots')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '更新成功',
        description: `机器人已${status === 'active' ? '启动' : '停止'}`,
      });

      loadBots();
    } catch (error: any) {
      toast({
        title: '更新失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此机器人吗？')) return;

    try {
      const { error } = await supabase
        .from('bots')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '删除成功',
        description: '机器人已删除',
      });

      loadBots();
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error: any) {
      toast({
        title: '退出失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (bot: Bot) => {
    const now = new Date();
    const expiresAt = bot.expires_at ? new Date(bot.expires_at) : null;
    
    if (expiresAt && expiresAt < now) {
      return <Badge variant="destructive">已过期</Badge>;
    }
    
    if (bot.status === 'active') {
      return <Badge className="bg-telegram-green">运行中</Badge>;
    }
    
    return <Badge variant="outline">已停止</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-destructive rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-destructive-foreground" />
            </div>
            <h1 className="text-2xl font-bold">管理员控制台</h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="w-5 h-5 mr-2" />
                添加机器人
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加新机器人</DialogTitle>
                <DialogDescription>
                  添加并激活一个新的 Telegram 机器人
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddBot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="botToken">机器人令牌 (Bot Token) *</Label>
                  <Input
                    id="botToken"
                    placeholder="123456:ABC-DEF..."
                    value={newBot.botToken}
                    onChange={(e) => setNewBot({ ...newBot, botToken: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="botName">机器人名称 (可选)</Label>
                  <Input
                    id="botName"
                    placeholder="我的机器人"
                    value={newBot.botName}
                    onChange={(e) => setNewBot({ ...newBot, botName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="developerId">开发者 Telegram ID *</Label>
                  <Input
                    id="developerId"
                    placeholder="123456789"
                    value={newBot.developerId}
                    onChange={(e) => setNewBot({ ...newBot, developerId: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDays">有效期（天）</Label>
                  <Input
                    id="expiryDays"
                    type="number"
                    min="1"
                    value={newBot.expiryDays}
                    onChange={(e) =>
                      setNewBot({ ...newBot, expiryDays: parseInt(e.target.value) })
                    }
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isAdding}>
                  {isAdding ? '添加中...' : '添加机器人'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>机器人列表</CardTitle>
            <CardDescription>管理所有已授权的 Telegram 机器人</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>机器人名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>开发者ID</TableHead>
                  <TableHead>有效期至</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bots.map((bot) => (
                  <TableRow key={bot.id}>
                    <TableCell>
                      {bot.bot_name || '未命名机器人'}
                    </TableCell>
                    <TableCell>{getStatusBadge(bot)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {bot.developer_id}
                    </TableCell>
                    <TableCell>
                      {bot.expires_at 
                        ? new Date(bot.expires_at).toLocaleDateString('zh-CN')
                        : '永久'}
                    </TableCell>
                    <TableCell>
                      {new Date(bot.created_at).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {bot.status === 'active' ? (
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleUpdateStatus(bot.id, 'inactive')}
                            title="停止"
                          >
                            <Square className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleUpdateStatus(bot.id, 'active')}
                            title="启动"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => handleDelete(bot.id)}
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {bots.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                暂无机器人记录
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
