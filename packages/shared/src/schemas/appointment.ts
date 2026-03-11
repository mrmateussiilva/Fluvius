import { z } from 'zod'

export const createAppointmentSchema = z.object({
  clinicId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  date: z.string().datetime(),
  status: z.enum(['scheduled', 'confirmed', 'canceled', 'completed']).optional(),
})

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
