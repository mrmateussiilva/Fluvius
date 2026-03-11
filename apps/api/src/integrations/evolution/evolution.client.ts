import { env } from '../../config/env.js'
import { createEvolutionInstanceSchema } from './evolution.schemas.js'
import type {
  CreateEvolutionInstanceInput,
  EvolutionInstanceResponse,
  EvolutionQrCodeResponse,
  EvolutionStatusResponse,
} from './evolution.types.js'

function ensureObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function extractString(data: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return null
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = env.EVOLUTION_API_URL.replace(/\/$/, '')
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: env.EVOLUTION_API_KEY,
      'x-api-key': env.EVOLUTION_API_KEY,
      Authorization: `Bearer ${env.EVOLUTION_API_KEY}`,
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(`Evolution API error: ${response.status} ${response.statusText}`)
  }

  return data as T
}

export const evolutionClient = {
  async createInstance(input: CreateEvolutionInstanceInput): Promise<EvolutionInstanceResponse> {
    const parsed = createEvolutionInstanceSchema.parse(input)

    const data = await request<unknown>('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ instanceName: parsed.instanceName }),
    })

    const raw = ensureObject(data)
    const instance = ensureObject(raw.instance || raw.data || raw)

    return {
      instanceName:
        extractString(instance, ['instanceName', 'name']) ||
        extractString(raw, ['instanceName', 'name']) ||
        parsed.instanceName,
      externalId:
        extractString(instance, ['instanceName', 'name', 'id']) ||
        extractString(raw, ['instanceName', 'name', 'id']) ||
        parsed.instanceName,
      status:
        extractString(instance, ['state', 'status', 'connectionStatus']) ||
        extractString(raw, ['state', 'status', 'connectionStatus']) ||
        'pending',
      qrCode: extractString(instance, ['qrcode', 'base64', 'qr']) || extractString(raw, ['qrcode', 'base64', 'qr']),
      phone: extractString(instance, ['ownerJid', 'number', 'phone']) || extractString(raw, ['ownerJid', 'number', 'phone']),
      raw: data,
    }
  },

  async getInstanceQrCode(instanceName: string): Promise<EvolutionQrCodeResponse> {
    const data = await request<unknown>(`/instance/connect/${instanceName}`)
    const raw = ensureObject(data)
    const payload = ensureObject(raw.instance || raw.data || raw)

    return {
      qrCode: extractString(payload, ['qrcode', 'base64', 'qr']) || extractString(raw, ['qrcode', 'base64', 'qr']),
      raw: data,
    }
  },

  async getInstanceStatus(instanceName: string): Promise<EvolutionStatusResponse> {
    const data = await request<unknown>(`/instance/connectionState/${instanceName}`)
    const raw = ensureObject(data)
    const payload = ensureObject(raw.instance || raw.data || raw)

    return {
      status:
        extractString(payload, ['state', 'status', 'connectionStatus']) ||
        extractString(raw, ['state', 'status', 'connectionStatus']) ||
        'unknown',
      raw: data,
    }
  },
}
