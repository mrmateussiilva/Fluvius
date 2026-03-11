import { z } from 'zod'

export const createServiceSchema = z.object({
  clinicId: z.string().cuid(),
  name: z.string().min(1),
  price: z.number().positive(),
  durationMinutes: z.number().int().positive(),
  active: z.boolean().optional(),
})

export type CreateServiceInput = z.infer<typeof createServiceSchema>
