import type { FastifyInstance } from 'fastify'
import { messageSchemas } from './schema.js'
import { messageService } from './service.js'

export async function messageRoutes(app: FastifyInstance) {
  app.post('/messages', async (request, reply) => {
    const parsed = messageSchemas.create.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const message = await messageService.create(parsed.data)
    return message
  })

  app.get('/messages', async (request, reply) => {
    const { conversationId } = request.query as { conversationId?: string }
    
    if (!conversationId) {
      return reply.status(400).send({ error: 'conversationId is required' })
    }

    return messageService.findByConversationId(conversationId)
  })
}
