import { z } from 'zod'

export const createConversationSchema = z.object({
  clinicId: z.string().uuid(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  assignedUserId: z.string().uuid().optional(),
  status: z.enum(['open', 'pending', 'closed']).optional(),
})

export type CreateConversationInput = z.infer<typeof createConversationSchema>
