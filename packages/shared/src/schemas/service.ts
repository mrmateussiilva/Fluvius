import { z } from 'zod'

export const createServiceSchema = z.object({
  clinicId: z.string().uuid(),
  name: z.string().min(1),
  price: z.number().positive(),
  durationMinutes: z.number().positive(),
  active: z.boolean().optional(),
})

export type CreateServiceInput = z.infer<typeof createServiceSchema>
