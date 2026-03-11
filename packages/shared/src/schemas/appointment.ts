import { z } from 'zod'

export const createAppointmentSchema = z.object({
  clinicId: z.string().cuid(),
  conversationId: z.string().cuid(),
  serviceId: z.string().cuid(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  date: z.string().datetime(),
  status: z.enum(['scheduled', 'confirmed', 'canceled', 'completed']).optional(),
})

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
