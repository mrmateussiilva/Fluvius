export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
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

const getErrorMessage = async (response: Response, fallback: string) => {
  try {
    const data = await response.json();
    if (typeof data.detail === 'string') return data.detail;
  } catch {
    // Ignore non-JSON error bodies.
  }
  return fallback;
};

export interface Agent {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator';
  is_online: boolean;
  avatar_url?: string;
  created_at: string;
}

export interface AgentKanbanData {
  agent: Agent;
  open: Conversation[];
  resolved: Conversation[];
}

export interface KanbanResponse {
  queue: Conversation[];
  by_agent: AgentKanbanData[];
}

export interface DashboardStatusSummary {
  bot: number;
  pending: number;
  open: number;
  resolved: number;
}

export interface DashboardMessageSummary {
  total: number;
  inbound: number;
  outbound: number;
  today: number;
  last_7_days: number;
}

export interface DashboardAgentSummary {
  id: string;
  name: string;
  open: number;
  resolved: number;
  unread: number;
  is_online: boolean;
}

export interface DashboardRecentConversation {
  id: string;
  contact_name: string;
  contact_phone: string;
  status: string;
  unread_count: number;
  last_message_at: string | null;
  assignee_name: string | null;
}

export interface DashboardConnectionSummary {
  name: string;
  status: string;
  instance: string;
}

export interface DashboardData {
  totals: {
    contacts: number;
    groups: number;
    conversations: number;
    unread: number;
    agents: number;
    online_agents: number;
  };
  statuses: DashboardStatusSummary;
  messages: DashboardMessageSummary;
  agents: DashboardAgentSummary[];
  recent_conversations: DashboardRecentConversation[];
  connections: DashboardConnectionSummary[];
  sla: {
    avg_response_minutes: number;
    avg_resolution_minutes: number;
  };
  sentiments: {
    POSITIVE: number;
    NEUTRAL: number;
    NEGATIVE: number;
    URGENT: number;
  };
}

export interface Contact {
  id: string;
  phone: string;
  name: string | null;
  avatar_url: string | null;
  tags: string[];
}

export interface Conversation {
  id: string;
  workspace_id: string;
  inbox_id: string;
  contact_id: string;
  assignee_id: string | null;
  queue_id: string | null;
  status: string;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview?: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
  assignee?: Agent | null;
}

export interface ConversationPage {
  items: Conversation[];
  limit: number;
  offset: number;
  next_offset: number | null;
  next_cursor: string | null;
  has_more: boolean;
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
  is_internal?: boolean;
  author_agent_id?: string | null;
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
  // Inbox fields joined in response
  welcome_message?: string;
  default_bot_active?: boolean;
  bot_type?: 'menu' | 'ai';
  ai_instructions?: string;
}

export interface Queue {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface QuickReply {
  id: string;
  workspace_id: string;
  shortcut: string;
  content: string;
}

export const getQueues = async (): Promise<Queue[]> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/queues`);
  if (!response.ok) throw new Error('Failed to fetch queues');
  return response.json();
};

export const createQueue = async (data: { name: string; description?: string }): Promise<Queue> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/queues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create queue');
  return response.json();
};

export const updateQueue = async (id: string, data: { name?: string; description?: string }): Promise<Queue> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/queues/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update queue');
  return response.json();
};

export const deleteQueue = async (id: string): Promise<void> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/queues/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete queue');
};

export const getQueueAgents = async (queueId: string): Promise<string[]> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/queues/${queueId}/agents`);
  if (!response.ok) throw new Error('Failed to fetch queue agents');
  return response.json();
};

export const updateQueueAgents = async (queueId: string, agentIds: string[]): Promise<void> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/queues/${queueId}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_ids: agentIds }),
  });
  if (!response.ok) throw new Error('Failed to update queue agents');
};

export const transferConversation = async (
  conversationId: string,
  data: { agent_id?: string; queue_id?: string }
): Promise<Conversation> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to transfer conversation'));
  return response.json();
};

export const fetchConversations = async (
  status?: string,
  options?: { limit?: number; offset?: number; cursor?: string | null; updatedAfter?: string | null }
): Promise<Conversation[] | ConversationPage> => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.offset !== undefined) params.set('offset', String(options.offset));
  if (options?.cursor) params.set('cursor', options.cursor);
  if (options?.updatedAfter) params.set('updated_after', options.updatedAfter);

  const query = params.toString();
  const url = query
    ? `${API_BASE_URL}/conversations?${query}`
    : `${API_BASE_URL}/conversations`;
  const response = await fetchWithAuth(url);
  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }
  return response.json();
};

export const startConversation = async (data: { phone: string; name?: string; inbox_id?: string }): Promise<Conversation> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to start conversation');
  return response.json();
};

export const fetchMessages = async (conversationId: string, beforeDate?: string, limit: number = 50): Promise<Message[]> => {
  let url = `${API_BASE_URL}/conversations/${conversationId}/messages?limit=${limit}`;
  if (beforeDate) {
    url += `&before_date=${encodeURIComponent(beforeDate)}`;
  }
  const response = await fetchWithAuth(url);
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
    throw new Error(await getErrorMessage(response, 'Failed to send message'));
  }
  return response.json();
};

export const sendInternalNote = async (conversationId: string, content: string): Promise<Message> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, is_internal: true }),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to send internal note'));
  }
  return response.json();
};

export const sendMediaMessage = async (conversationId: string, media: string, mediaType: string, mimetype: string, caption?: string, quotedMessageId?: string): Promise<Message> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/messages/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media, media_type: mediaType, mimetype, caption, quoted_message_id: quotedMessageId }),
  });
  if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to send media message'));
  return response.json();
};

export const assignConversation = async (conversationId: string, agentId: string): Promise<Conversation> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId }),
  });
  if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to assign conversation'));
  return response.json();
};

export const resolveConversation = async (conversationId: string): Promise<Conversation> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/resolve`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to resolve conversation'));
  return response.json();
};

export const fetchKanban = async (): Promise<KanbanResponse> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/admin/kanban`);
  return response.json();
};

export const fetchDashboard = async (): Promise<DashboardData> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/dashboard`);
  if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to fetch dashboard'));
  return response.json();
};

export const updateAgent = async (agentId: string, data: any): Promise<Agent> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const deleteAgent = async (agentId: string): Promise<void> => {
  await fetchWithAuth(`${API_BASE_URL}/agents/${agentId}`, {
    method: 'DELETE',
  });
};

export const inviteAgent = async (data: any): Promise<Agent> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const pendingConversation = async (conversationId: string): Promise<Conversation> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/pending`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to requeue conversation'));
  return response.json();
};

export const markAsRead = async (conversationId: string): Promise<Conversation> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/read`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to mark conversation as read'));
  return response.json();
};

export const updateContactTags = async (contactId: string, tags: string[]): Promise<Contact> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/contacts/${contactId}/tags`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  });
  if (!response.ok) throw new Error('Failed to update contact tags');
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

export const createConnection = async (data: { name: string; instance_name?: string }): Promise<Connection> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create connection');
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

export const deleteConnection = async (connectionId: string): Promise<void> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/connections/${connectionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete connection');
};

export const logoutConnection = async (connectionId: string): Promise<any> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/connections/${connectionId}/logout`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to logout connection');
  return response.json();
};

export const restartConnection = async (connectionId: string): Promise<any> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/connections/${connectionId}/restart`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to restart connection');
  return response.json();
};

export const syncConnection = async (connectionId: string): Promise<any> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/connections/${connectionId}/sync`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to sync connection');
  return response.json();
};

export interface SuggestReplyResponse {
  suggestion: string;
  suggestions: string[];
}

export const suggestReply = async (conversationId: string): Promise<SuggestReplyResponse> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/suggest-reply`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorMsg = await getErrorMessage(response, 'Falha ao gerar sugestões de IA');
    throw new Error(errorMsg);
  }
  return response.json();
};

export const summarizeConversation = async (conversationId: string): Promise<string> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/summarize`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorMsg = await getErrorMessage(response, 'Falha ao gerar resumo da conversa');
    throw new Error(errorMsg);
  }
  const data = await response.json();
  return data.summary;
};

export const analyzeSentiment = async (conversationId: string): Promise<string> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/sentiment`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorMsg = await getErrorMessage(response, 'Falha ao analisar sentimento da conversa');
    throw new Error(errorMsg);
  }
  const data = await response.json();
  return data.sentiment;
};


export const updateConnection = async (connectionId: string, data: any): Promise<Connection> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/connections/${connectionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorMsg = await getErrorMessage(response, 'Failed to update connection');
    throw new Error(errorMsg);
  }
  return response.json();
};

export const fetchQuickReplies = async (): Promise<QuickReply[]> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/quick-replies`);
  if (!response.ok) throw new Error('Failed to fetch quick replies');
  return response.json();
};

export const createQuickReply = async (data: { shortcut: string, content: string }): Promise<QuickReply> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/quick-replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create quick reply');
  return response.json();
};

export const updateQuickReply = async (qrId: string, data: Partial<QuickReply>): Promise<QuickReply> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/quick-replies/${qrId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update quick reply');
  return response.json();
};

export const deleteQuickReply = async (qrId: string): Promise<void> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/quick-replies/${qrId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete quick reply');
};
