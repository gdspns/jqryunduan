import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Bot, MessageSquare, Shield, Zap } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

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
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/login')} className="text-lg px-8">
              立即开始
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="text-lg px-8">
              管理员登录
            </Button>
          </div>
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
