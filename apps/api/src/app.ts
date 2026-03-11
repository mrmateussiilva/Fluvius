import Fastify from 'fastify'
import cors from '@fastify/cors'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { clinicRoutes } from './modules/clinics/clinic.routes.js'
import { userRoutes } from './modules/users/user.routes.js'
import { serviceRoutes } from './modules/services/service.routes.js'
import { conversationRoutes } from './modules/conversations/conversation.routes.js'
import { messageRoutes } from './modules/messages/message.routes.js'
import { appointmentRoutes } from './modules/appointments/appointment.routes.js'

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

  return app
}
