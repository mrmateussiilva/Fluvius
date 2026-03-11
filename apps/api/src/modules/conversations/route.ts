import type { FastifyInstance } from 'fastify'
import { conversationSchemas } from './schema.js'
import { conversationService } from './service.js'

export async function conversationRoutes(app: FastifyInstance) {
  app.post('/conversations', async (request, reply) => {
    const parsed = conversationSchemas.create.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const conversation = await conversationService.create(parsed.data)
    return conversation
  })

  app.get('/conversations', async (request) => {
    const { clinicId, status } = request.query as { clinicId?: string; status?: string }
    return conversationService.findMany(clinicId, status)
  })

  app.get('/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const conversation = await conversationService.findById(id)

    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }

    return conversation
  })
}
