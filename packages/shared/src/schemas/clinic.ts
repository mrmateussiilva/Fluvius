import { z } from 'zod'

export const createClinicSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
})

export type CreateClinicInput = z.infer<typeof createClinicSchema>
