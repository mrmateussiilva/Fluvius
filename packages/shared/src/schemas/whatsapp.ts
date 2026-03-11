import { z } from 'zod'

export const createWhatsAppInstanceSchema = z.object({
  clinicId: z.string().cuid(),
})

export type CreateWhatsAppInstanceInput = z.infer<typeof createWhatsAppInstanceSchema>
