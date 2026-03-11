import type { FastifyInstance } from 'fastify'
import { whatsappInstanceSchemas } from './schema.js'
import { whatsappInstanceService } from './service.js'

export async function whatsappInstanceRoutes(app: FastifyInstance) {
  app.post('/whatsapp/instances', async (request, reply) => {
    const parsed = whatsappInstanceSchemas.create.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    try {
      const instance = await whatsappInstanceService.create(parsed.data)
      return instance
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error creating WhatsApp instance'
      const statusCode = message === 'Clinic not found' ? 404 : 500
      return reply.status(statusCode).send({ error: message })
    }
  })

  app.get('/whatsapp/instances', async (request, reply) => {
    const parsed = whatsappInstanceSchemas.listQuery.safeParse(request.query)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    return whatsappInstanceService.list(parsed.data.clinicId)
  })

  app.get('/whatsapp/instances/:id/qrcode', async (request, reply) => {
    const parsed = whatsappInstanceSchemas.params.safeParse(request.params)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const result = await whatsappInstanceService.getQrCode(parsed.data.id)

    if (!result) {
      return reply.status(404).send({ error: 'WhatsApp instance not found' })
    }

    return result
  })

  app.get('/whatsapp/instances/:id/status', async (request, reply) => {
    const parsed = whatsappInstanceSchemas.params.safeParse(request.params)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const result = await whatsappInstanceService.getStatus(parsed.data.id)

    if (!result) {
      return reply.status(404).send({ error: 'WhatsApp instance not found' })
    }

    return result
  })
}
