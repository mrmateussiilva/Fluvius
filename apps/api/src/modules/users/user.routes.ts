import { createUserSchema } from '@fluvius/shared'
import { prisma } from '../../lib/prisma.js'
import type { FastifyInstance } from 'fastify'

export async function userRoutes(app: FastifyInstance) {
  app.post('/users', async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const { password, ...data } = parsed.data

    const user = await prisma.user.create({
      data: {
        ...data,
        passwordHash: password,
      },
    })

    return user
  })

  app.get('/users', async (request) => {
    const { clinicId } = request.query as { clinicId?: string }
    
    const users = await prisma.user.findMany({
      where: clinicId ? { clinicId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return users
  })

  app.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return user
  })
}
