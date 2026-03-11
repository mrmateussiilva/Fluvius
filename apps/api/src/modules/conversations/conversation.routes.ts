import { createConversationSchema } from '@fluvius/shared'
import { prisma } from '../../lib/prisma.js'
import type { FastifyInstance } from 'fastify'

export async function conversationRoutes(app: FastifyInstance) {
  app.post('/conversations', async (request, reply) => {
    const parsed = createConversationSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const conversation = await prisma.conversation.create({
      data: parsed.data,
    })

    return conversation
  })

  app.get('/conversations', async (request) => {
    const { clinicId } = request.query as { clinicId?: string }
    
    const conversations = await prisma.conversation.findMany({
      where: clinicId ? { clinicId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    })
    return conversations
  })

  app.get('/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }

    return conversation
  })
}
