import { createServiceSchema } from '@fluvius/shared'
import { prisma } from '../../lib/prisma.js'
import type { FastifyInstance } from 'fastify'

export async function serviceRoutes(app: FastifyInstance) {
  app.post('/services', async (request, reply) => {
    const parsed = createServiceSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const service = await prisma.service.create({
      data: parsed.data,
    })

    return service
  })

  app.get('/services', async (request) => {
    const { clinicId } = request.query as { clinicId?: string }
    
    const services = await prisma.service.findMany({
      where: clinicId ? { clinicId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return services
  })

  app.get('/services/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const service = await prisma.service.findUnique({
      where: { id },
    })

    if (!service) {
      return reply.status(404).send({ error: 'Service not found' })
    }

    return service
  })
}
