import { z } from 'zod'

export const createUserSchema = z.object({
  clinicId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(['admin', 'attendant']).optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
