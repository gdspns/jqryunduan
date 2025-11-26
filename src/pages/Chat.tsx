import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { apiRequest, createWebSocket } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Message {
  id: string;
  direction: 'incoming' | 'outgoing';
  content: string;
  telegramUserId: string;
  telegramUsername: string;
  createdAt: string;
}

interface ChatUser {
  telegramUserId: string;
  telegramUsername: string;
  lastMessageTime: string;
}

const Chat = () => {
  const { botId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [showTrialEndDialog, setShowTrialEndDialog] = useState(false);
  const [trialMessagesSent, setTrialMessagesSent] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBotInfo();
    loadChatUsers();
    connectWebSocket();

    return () => {
      ws?.close();
    };
  }, [botId]);

  useEffect(() => {
    if (selectedUser) {
      loadMessages(selectedUser);
    }
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadBotInfo = async () => {
    try {
      const bot = await apiRequest(`/bots/${botId}`);
      setIsAuthorized(bot.isAuthorized);
      setTrialMessagesSent(bot.trialMessagesSent);
    } catch (error: any) {
      toast({
        title: '加载失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const loadChatUsers = async () => {
    try {
      const users = await apiRequest(`/bots/${botId}/users`);
      setChatUsers(users);
    } catch (error: any) {
      console.error('Failed to load users:', error);
    }
  };

  const loadMessages = async (userId: string) => {
    try {
      const msgs = await apiRequest(`/bots/${botId}/messages/${userId}`);
      setMessages(msgs);
    } catch (error: any) {
      toast({
        title: '加载消息失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const connectWebSocket = () => {
    const websocket = createWebSocket(`/chat/${botId}`);

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'new_message') {
        setMessages((prev) => [...prev, data.message]);
        loadChatUsers();
      } else if (data.type === 'trial_ended') {
        setShowTrialEndDialog(true);
      } else if (data.type === 'message_count') {
        setTrialMessagesSent(data.count);
      }
    };

    websocket.onerror = () => {
      toast({
        title: '连接错误',
        description: 'WebSocket 连接失败',
        variant: 'destructive',
      });
    };

    setWs(websocket);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedUser) return;

    if (!isAuthorized && trialMessagesSent >= 20) {
      setShowTrialEndDialog(true);
      return;
    }

    try {
      await apiRequest(`/bots/${botId}/send`, {
        method: 'POST',
        body: JSON.stringify({
          telegramUserId: selectedUser,
          content: inputMessage,
        }),
      });

      setInputMessage('');
      setTrialMessagesSent((prev) => prev + 1);
    } catch (error: any) {
      toast({
        title: '发送失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">机器人聊天</h1>
          {!isAuthorized && (
            <p className="text-sm text-muted-foreground">
              试用消息: {trialMessagesSent}/20
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 用户列表 */}
        <div className="w-80 border-r border-border bg-card overflow-y-auto">
          <div className="p-4">
            <h2 className="font-semibold mb-4">聊天用户</h2>
            {chatUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无用户消息
              </p>
            ) : (
              <div className="space-y-2">
                {chatUsers.map((user) => (
                  <Card
                    key={user.telegramUserId}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedUser === user.telegramUserId
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedUser(user.telegramUserId)}
                  >
                    <p className="font-medium">{user.telegramUsername}</p>
                    <p className="text-xs opacity-70">
                      {new Date(user.lastMessageTime).toLocaleString()}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 消息区域 */}
        <div className="flex-1 flex flex-col">
          {selectedUser ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        msg.direction === 'outgoing'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {msg.direction === 'incoming' && (
                        <p className="text-xs opacity-70 mb-1">{msg.telegramUsername}</p>
                      )}
                      <p className="break-words">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-border p-4">
                {!isAuthorized && trialMessagesSent >= 20 && (
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>试用已结束</AlertTitle>
                    <AlertDescription>
                      您已发送20条试用消息，请联系管理员激活授权
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="输入消息..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={!isAuthorized && trialMessagesSent >= 20}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!isAuthorized && trialMessagesSent >= 20}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>请选择一个用户开始聊天</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showTrialEndDialog} onOpenChange={setShowTrialEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>试用已结束</DialogTitle>
            <DialogDescription>
              您已发送20条试用消息。请联系管理员获取授权激活链接以继续使用。
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowTrialEndDialog(false)}>知道了</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Chat;
