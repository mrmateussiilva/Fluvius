import { FastifyInstance } from 'fastify'
import { loginSchema } from '@fluvius/shared'
import { prisma } from '../lib/prisma.js'

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const { email } = parsed.data

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return reply.status(401).send({
        error: 'Invalid credentials',
      })
    }

    const token = `fake-token-${user.id}-${Date.now()}`

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      },
    }
  })
}
