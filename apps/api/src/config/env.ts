import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  EVOLUTION_API_URL: z.string().url('EVOLUTION_API_URL must be a valid URL'),
  EVOLUTION_API_KEY: z.string().min(1, 'EVOLUTION_API_KEY is required'),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsedEnv.data
