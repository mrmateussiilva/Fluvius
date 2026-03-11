import { createWhatsAppInstanceSchema } from '@fluvius/shared'
import { z } from 'zod'

export const whatsappInstanceSchemas = {
  create: createWhatsAppInstanceSchema,
  listQuery: z.object({
    clinicId: z.string().cuid().optional(),
  }),
  params: z.object({
    id: z.string().min(1),
  }),
}
