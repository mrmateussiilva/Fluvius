import Fastify from 'fastify'
import cors from '@fastify/cors'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'

export async function buildApp() {
  const app = Fastify({
    logger: true,
  })

  await app.register(cors, {
    origin: true,
  })

  await app.register(healthRoutes)
  await app.register(authRoutes)

  return app
}
