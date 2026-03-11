import type { FastifyInstance } from 'fastify'
import { serviceSchemas } from './schema.js'
import { serviceService } from './service.js'

export async function serviceRoutes(app: FastifyInstance) {
  app.post('/services', async (request, reply) => {
    const parsed = serviceSchemas.create.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const service = await serviceService.create(parsed.data)
    return service
  })

  app.get('/services', async (request) => {
    const { clinicId } = request.query as { clinicId?: string }
    return serviceService.findMany(clinicId)
  })

  app.get('/services/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const service = await serviceService.findById(id)

    if (!service) {
      return reply.status(404).send({ error: 'Service not found' })
    }

    return service
  })
}
