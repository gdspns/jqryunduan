// API 配置 - 连接到您自己部署的后端服务器
// 部署后请修改此处的 API_BASE_URL 为您的服务器地址

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

// API 请求辅助函数
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
};

// WebSocket 连接辅助函数
export const createWebSocket = (path: string) => {
  const token = localStorage.getItem('auth_token');
  const wsUrl = `${WS_BASE_URL}${path}?token=${token}`;
  return new WebSocket(wsUrl);
};
