import { createMessageSchema } from '@fluvius/shared'
import { prisma } from '../../lib/prisma.js'
import type { FastifyInstance } from 'fastify'

export async function messageRoutes(app: FastifyInstance) {
  app.post('/messages', async (request, reply) => {
    const parsed = createMessageSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const message = await prisma.message.create({
      data: parsed.data,
    })

    return message
  })

  app.get('/messages', async (request, reply) => {
    const { conversationId } = request.query as { conversationId?: string }
    
    if (!conversationId) {
      return reply.status(400).send({ error: 'conversationId is required' })
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })
    return messages
  })
}
