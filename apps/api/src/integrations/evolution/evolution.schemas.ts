import { z } from 'zod'

export const createEvolutionInstanceSchema = z.object({
  instanceName: z.string().min(1),
})
