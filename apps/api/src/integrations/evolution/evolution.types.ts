export type CreateEvolutionInstanceInput = {
  instanceName: string
}

export type EvolutionInstanceResponse = {
  instanceName: string
  externalId: string
  status: string
  qrCode?: string | null
  phone?: string | null
  raw: unknown
}

export type EvolutionQrCodeResponse = {
  qrCode: string | null
  raw: unknown
}

export type EvolutionStatusResponse = {
  status: string
  raw: unknown
}
