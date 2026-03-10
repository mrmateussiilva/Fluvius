const API_BASE_URL = '/api'

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }

  return response.json()
}

export const api = {
  post: <T = unknown>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  get: <T = unknown>(endpoint: string) =>
    fetchApi<T>(endpoint),
}

export async function login(email: string, password: string) {
  const response = await api.post<{ message: string; user: { email: string } }>('/auth/login', { email, password })
  return response
}
