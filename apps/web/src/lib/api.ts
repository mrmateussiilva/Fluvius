import {
  type ConversationResponse,
  type MessageResponse,
  type UserResponse,
  type AttendantStatsResponse
} from '@fluvius/shared'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `API Error: ${response.statusText}`)
  }

  return response.json()
}

export const api = {
  post: <T = unknown>(endpoint: string, data?: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  get: <T = unknown>(endpoint: string) =>
    fetchApi<T>(endpoint),
  put: <T = unknown>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: <T = unknown>(endpoint: string) =>
    fetchApi<T>(endpoint, {
      method: 'DELETE',
    }),
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: { id: string; name: string; email: string; role: string } }>('/auth/login', { email, password }),
}

export const clinicApi = {
  list: () => api.get<Array<{ id: string; name: string; slug: string }>>('/clinics'),
}

export const userApi = {
  list: (clinicId?: string) => api.get<Array<UserResponse>>(`/users${clinicId ? `?clinicId=${clinicId}` : ''}`),
  getAttendantsStats: (clinicId?: string) => api.get<Array<AttendantStatsResponse>>(`/users/attendants/stats${clinicId ? `?clinicId=${clinicId}` : ''}`),
}

export const serviceApi = {
  list: (clinicId?: string) => api.get<Array<{ id: string; name: string; price: number; durationMinutes: number; active: boolean }>>(`/services${clinicId ? `?clinicId=${clinicId}` : ''}`),
  create: (data: { clinicId: string; name: string; price: number; durationMinutes: number; active?: boolean }) =>
    api.post<{ id: string; name: string; price: number; durationMinutes: number; active: boolean }>('/services', data),
}

export const conversationApi = {
  list: (clinicId?: string, status?: string) => {
    const params = new URLSearchParams()
    if (clinicId) params.append('clinicId', clinicId)
    if (status) params.append('status', status)
    const query = params.toString() ? `?${params.toString()}` : ''
    return api.get<Array<ConversationResponse>>(`/conversations${query}`)
  },
  get: (id: string) => api.get<ConversationResponse>(`/conversations/${id}`),
}

export const messageApi = {
  list: (conversationId: string) => api.get<Array<MessageResponse>>(`/messages?conversationId=${conversationId}`),
  create: (data: { conversationId: string; direction: 'inbound' | 'outbound'; content: string }) =>
    api.post<MessageResponse>('/messages', data),
}

export const appointmentApi = {
  list: (clinicId?: string) => api.get<Array<{ id: string; clinicId: string; customerName: string; customerPhone: string; date: string; status: string; service: { id: string; name: string; price: number } }>>(`/appointments${clinicId ? `?clinicId=${clinicId}` : ''}`),
}

export const dashboardApi = {
  getStats: (clinicId?: string) => api.get<{ conversations: number; services: number; appointments: number }>(`/dashboard/stats${clinicId ? `?clinicId=${clinicId}` : ''}`),
}
