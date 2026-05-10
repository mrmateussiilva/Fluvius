export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  const token = localStorage.getItem('fluvius_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    // Handle unauthorized - maybe redirect or clear storage
    localStorage.removeItem('fluvius_token');
    localStorage.removeItem('fluvius_user');
    window.location.href = '/login';
  }
  return response;
};

export interface Agent {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_online: boolean;
  role: string;
  created_at: string;
}

export interface Contact {
  id: string;
  phone: string;
  name: string | null;
  avatar_url: string | null;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  inbox_id: string;
  contact_id: string;
  assignee_id: string | null;
  status: string;
  unread_count: number;
  last_message_at: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
  assignee?: Agent | null;
}

export interface Message {
  id: string;
  workspace_id: string;
  conversation_id: string;
  contact_id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string;
  media_url?: string | null;
  mime_type?: string | null;
  external_message_id: string | null;
  status: string;
  created_at: string;
  quoted_message_id?: string | null;
  quoted_content?: string | null;
}

export interface Connection {
  id: string;
  workspace_id: string;
  inbox_id: string;
  name: string;
  provider: string;
  instance_name: string;
  status: string;
  created_at: string;
}

export const fetchConversations = async (status?: string): Promise<Conversation[]> => {
  const url = status
    ? `${API_BASE_URL}/conversations?status=${status}`
    : `${API_BASE_URL}/conversations`;
  const response = await fetchWithAuth(url);
  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }
  return response.json();
};

export const fetchMessages = async (conversationId: string): Promise<Message[]> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/messages`);
  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }
  return response.json();
};
export const sendMessage = async (conversationId: string, content: string, quotedMessageId?: string): Promise<Message> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, quoted_message_id: quotedMessageId }),
  });
  if (!response.ok) {
    throw new Error('Failed to send message');
  }
  return response.json();
};

export const sendMediaMessage = async (conversationId: string, media: string, mediaType: string, mimetype: string, caption?: string, quotedMessageId?: string): Promise<Message> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/messages/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media, media_type: mediaType, mimetype, caption, quoted_message_id: quotedMessageId }),
  });
  if (!response.ok) throw new Error('Failed to send media message');
  return response.json();
};

export const assignConversation = async (conversationId: string, agentId: string): Promise<Conversation> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId }),
  });
  if (!response.ok) throw new Error('Failed to assign conversation');
  return response.json();
};

export const resolveConversation = async (conversationId: string): Promise<Conversation> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/resolve`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to resolve conversation');
  return response.json();
};

export const pendingConversation = async (conversationId: string): Promise<Conversation> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/pending`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to requeue conversation');
  return response.json();
};

export const markAsRead = async (conversationId: string): Promise<Conversation> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/read`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to mark conversation as read');
  return response.json();
};

export const fetchAgents = async (): Promise<Agent[]> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/agents`);
  if (!response.ok) throw new Error('Failed to fetch agents');
  return response.json();
};

export const fetchConnections = async (): Promise<Connection[]> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/connections`);
  if (!response.ok) {
    throw new Error('Failed to fetch connections');
  }
  return response.json();
};

export const fetchConnectionQR = async (connectionId: string): Promise<any> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/connections/${connectionId}/qr`);
  if (!response.ok) {
    throw new Error('Failed to fetch QR code');
  }
  return response.json();
};

export const fetchConnectionStatus = async (connectionId: string): Promise<any> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/connections/${connectionId}/status`);
  if (!response.ok) {
    throw new Error('Failed to fetch connection status');
  }
  return response.json();
};
