import { z } from 'zod'

export const createConversationSchema = z.object({
  clinicId: z.string().cuid(),
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().min(1),
  assignedUserId: z.string().cuid().optional(),
  status: z.enum(['open', 'pending', 'closed']).optional(),
})

export type CreateConversationInput = z.infer<typeof createConversationSchema>
