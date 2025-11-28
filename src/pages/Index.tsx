import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Bot, MessageSquare, Shield, Zap, Send } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [botToken, setBotToken] = useState('');
  const [developerId, setDeveloperId] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trialMessages, setTrialMessages] = useState<Array<{role: string, content: string}>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [botId, setBotId] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);

  const handleStartTrial = async () => {
    if (!botToken.trim() || !developerId.trim()) {
      toast({
        title: '错误',
        description: '请填写机器人令牌和个人ID',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('trial_bots')
        .insert({
          bot_token: botToken,
          developer_id: developerId,
          welcome_message: welcomeMessage || '欢迎使用！这是试用模式，您有20条免费消息。',
          message_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      setBotId(data.id);
      toast({
        title: '成功',
        description: '试用已开始！您可以发送20条消息进行测试。',
      });
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '启动试用失败',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !botId) return;

    if (messageCount >= 20) {
      toast({
        title: '试用已结束',
        description: '您已使用完20条免费消息，请联系管理员激活授权。',
        variant: 'destructive',
      });
      return;
    }

    const userMessage = currentMessage;
    setCurrentMessage('');
    setTrialMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // 更新消息计数
      const { data, error } = await supabase
        .from('trial_bots')
        .update({ message_count: messageCount + 1 })
        .eq('id', botId)
        .select()
        .single();

      if (error) throw error;

      setMessageCount(data.message_count);
      setTrialMessages(prev => [...prev, { 
        role: 'bot', 
        content: '消息已记录！实际的 Telegram 机器人需要连接 bot-service 才能发送消息。' 
      }]);

      // 自动滚动到底部
      setTimeout(() => {
        const messagesContainer = document.getElementById('trial-messages');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);

      if (data.message_count >= 20) {
        setTimeout(() => {
          toast({
            title: '试用已结束',
            description: '您已使用完20条免费消息。请注册并联系管理员激活授权以继续使用。',
            variant: 'destructive',
          });
        }, 1000);
      }
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '发送消息失败',
        variant: 'destructive',
      });
      // 发送失败时移除用户消息
      setTrialMessages(prev => prev.slice(0, -1));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-telegram-bg via-background to-telegram-bg">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-primary rounded-3xl mb-8 shadow-2xl">
            <Bot className="w-14 h-14 text-primary-foreground" />
          </div>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Telegram 机器人管理系统
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            集中管理和授权多个 Telegram 机器人，实现网站控制台与 Telegram 的双向无缝聊天
          </p>
        </div>

        {/* 试用窗口 */}
        <div className="max-w-4xl mx-auto mb-16">
          <Card className="p-8 shadow-2xl border-2 border-primary/20">
            <h2 className="text-3xl font-bold mb-6 text-center">免费试用 - 20条消息</h2>
            
            {!botId ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="botToken">机器人令牌 (Bot Token) *</Label>
                  <Input
                    id="botToken"
                    placeholder="例如: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="developerId">开发者个人 ID *</Label>
                  <Input
                    id="developerId"
                    placeholder="例如: 123456789"
                    value={developerId}
                    onChange={(e) => setDeveloperId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">自动欢迎语 (可选)</Label>
                  <Textarea
                    id="welcomeMessage"
                    placeholder="自定义欢迎消息..."
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button 
                  size="lg" 
                  className="w-full text-lg"
                  onClick={handleStartTrial}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '正在启动...' : '开始试用'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">
                    已使用: {messageCount} / 20 条消息
                  </span>
                  {messageCount >= 20 && (
                    <Button onClick={() => navigate('/activate')} size="sm">
                      激活授权
                    </Button>
                  )}
                </div>

                <div className="bg-muted/30 rounded-lg p-4 h-96 overflow-y-auto space-y-3" id="trial-messages">
                  {trialMessages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-16">
                      <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">开始您的试用体验</p>
                      <p className="text-sm">发送消息测试机器人功能</p>
                    </div>
                  ) : (
                    trialMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card text-card-foreground border'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <span className="text-xs opacity-70 mt-1 block">
                            {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder={messageCount >= 20 ? "试用已结束，请激活授权..." : "输入消息..."}
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    disabled={messageCount >= 20}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={messageCount >= 20 || !currentMessage.trim()}
                    size="icon"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground text-center">
                  💡 提示：消息将同步到您的 Telegram 机器人
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="flex gap-4 justify-center mb-16">
          <Button size="lg" onClick={() => navigate('/login')} className="text-lg px-8">
            用户登录
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="text-lg px-8">
            管理员登录
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-card p-8 rounded-2xl border border-border shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">双向实时聊天</h3>
            <p className="text-muted-foreground">
              在网站控制台与 Telegram App 内实现无缝双向聊天，消息实时同步
            </p>
          </div>

          <div className="bg-card p-8 rounded-2xl border border-border shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-telegram-green/10 rounded-xl flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-telegram-green" />
            </div>
            <h3 className="text-xl font-semibold mb-3">7x24 小时在线</h3>
            <p className="text-muted-foreground">
              独立的后台服务保证机器人永久在线，不受网站状态影响
            </p>
          </div>

          <div className="bg-card p-8 rounded-2xl border border-border shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-3">授权管理</h3>
            <p className="text-muted-foreground">
              完善的授权机制，试用 20 条消息后需要激活，支持设置有效期
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <div className="bg-card p-8 rounded-2xl border border-border max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">核心功能</h2>
            <ul className="text-left space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold">•</span>
                <span>多机器人支持：同时管理多个已授权的 Telegram 机器人</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold">•</span>
                <span>消息路由：确保每个用户的消息准确到达，互不干扰</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold">•</span>
                <span>试用机制：新用户可免费试用 20 条消息</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold">•</span>
                <span>超级管理员后台：完整的授权管理、生成激活链接、设置有效期</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
