import type { FastifyInstance } from 'fastify'
import { clinicSchemas } from './schema.js'
import { clinicService } from './service.js'

export async function clinicRoutes(app: FastifyInstance) {
  app.post('/clinics', async (request, reply) => {
    const parsed = clinicSchemas.create.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const clinic = await clinicService.create(parsed.data)
    return clinic
  })

  app.get('/clinics', async () => {
    return clinicService.findMany()
  })

  app.get('/clinics/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const clinic = await clinicService.findById(id)

    if (!clinic) {
      return reply.status(404).send({ error: 'Clinic not found' })
    }

    return clinic
  })
}
