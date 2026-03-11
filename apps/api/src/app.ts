import Fastify from 'fastify'
import cors from '@fastify/cors'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { clinicRoutes } from './modules/clinics/route.js'
import { userRoutes } from './modules/users/route.js'
import { serviceRoutes } from './modules/services/route.js'
import { conversationRoutes } from './modules/conversations/route.js'
import { messageRoutes } from './modules/messages/route.js'
import { appointmentRoutes } from './modules/appointments/route.js'
import { whatsappInstanceRoutes } from './modules/whatsapp-instances/route.js'

export async function buildApp() {
  const app = Fastify({
    logger: true,
  })

  await app.register(cors, {
    origin: true,
  })

  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(clinicRoutes)
  await app.register(userRoutes)
  await app.register(serviceRoutes)
  await app.register(conversationRoutes)
  await app.register(messageRoutes)
  await app.register(appointmentRoutes)
  await app.register(whatsappInstanceRoutes)

  return app
}
