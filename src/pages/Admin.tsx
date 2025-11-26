import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Shield, LogOut, Plus, Play, Square, Trash2, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface BotAuthorization {
  id: string;
  botToken: string;
  botName: string;
  status: 'active' | 'stopped' | 'expired';
  expiryDate: string;
  activationCode: string;
  activationUrl: string;
  isUsed: boolean;
  createdAt: string;
}

const Admin = () => {
  const [authorizations, setAuthorizations] = useState<BotAuthorization[]>([]);
  const [newAuth, setNewAuth] = useState({
    botToken: '',
    expiryDays: 30,
  });
  const [isAdding, setIsAdding] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const userRole = localStorage.getItem('user_role');
    if (userRole !== 'admin') {
      navigate('/dashboard');
      return;
    }

    loadAuthorizations();
  }, []);

  const loadAuthorizations = async () => {
    try {
      const data = await apiRequest('/admin/authorizations');
      setAuthorizations(data);
    } catch (error: any) {
      toast({
        title: '加载失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddAuthorization = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);

    try {
      const result = await apiRequest('/admin/authorizations', {
        method: 'POST',
        body: JSON.stringify(newAuth),
      });

      toast({
        title: '授权已创建',
        description: `激活链接: ${result.activationUrl}`,
      });

      setNewAuth({ botToken: '', expiryDays: 30 });
      loadAuthorizations();
    } catch (error: any) {
      toast({
        title: '创建失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'active' | 'stopped') => {
    try {
      await apiRequest(`/admin/authorizations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      toast({
        title: '更新成功',
        description: `机器人已${status === 'active' ? '启动' : '停止'}`,
      });

      loadAuthorizations();
    } catch (error: any) {
      toast({
        title: '更新失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此授权吗？')) return;

    try {
      await apiRequest(`/admin/authorizations/${id}`, {
        method: 'DELETE',
      });

      toast({
        title: '删除成功',
        description: '授权已删除',
      });

      loadAuthorizations();
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: '已复制',
      description: '激活链接已复制到剪贴板',
    });
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const getStatusBadge = (auth: BotAuthorization) => {
    if (auth.status === 'active') {
      return <Badge className="bg-telegram-green">运行中</Badge>;
    }
    if (auth.status === 'expired') {
      return <Badge variant="destructive">已过期</Badge>;
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
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="w-5 h-5 mr-2" />
                添加授权
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新授权</DialogTitle>
                <DialogDescription>
                  为机器人生成激活链接和授权码
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddAuthorization} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="botToken">机器人令牌 (Bot Token)</Label>
                  <Input
                    id="botToken"
                    placeholder="123456:ABC-DEF..."
                    value={newAuth.botToken}
                    onChange={(e) => setNewAuth({ ...newAuth, botToken: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDays">有效期（天）</Label>
                  <Input
                    id="expiryDays"
                    type="number"
                    min="1"
                    value={newAuth.expiryDays}
                    onChange={(e) =>
                      setNewAuth({ ...newAuth, expiryDays: parseInt(e.target.value) })
                    }
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isAdding}>
                  {isAdding ? '创建中...' : '创建授权'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>授权列表</CardTitle>
            <CardDescription>管理所有机器人的授权状态</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>机器人令牌</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>有效期至</TableHead>
                  <TableHead>激活链接</TableHead>
                  <TableHead>已激活</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authorizations.map((auth) => (
                  <TableRow key={auth.id}>
                    <TableCell className="font-mono text-sm">
                      {auth.botToken.substring(0, 20)}...
                    </TableCell>
                    <TableCell>{getStatusBadge(auth)}</TableCell>
                    <TableCell>
                      {new Date(auth.expiryDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {auth.activationCode}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyToClipboard(auth.activationUrl)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {auth.isUsed ? (
                        <Badge>已激活</Badge>
                      ) : (
                        <Badge variant="outline">未激活</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {auth.status === 'active' ? (
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleUpdateStatus(auth.id, 'stopped')}
                          >
                            <Square className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleUpdateStatus(auth.id, 'active')}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => handleDelete(auth.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {authorizations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                暂无授权记录
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
