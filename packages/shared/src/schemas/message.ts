import { z } from 'zod'

export const createMessageSchema = z.object({
  conversationId: z.string().uuid(),
  direction: z.enum(['inbound', 'outbound']),
  content: z.string().min(1),
})

export type CreateMessageInput = z.infer<typeof createMessageSchema>
