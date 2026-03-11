import { createClinicSchema } from '@fluvius/shared'
import { prisma } from '../../lib/prisma.js'
import type { FastifyInstance } from 'fastify'

export async function clinicRoutes(app: FastifyInstance) {
  app.post('/clinics', async (request, reply) => {
    const parsed = createClinicSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const clinic = await prisma.clinic.create({
      data: parsed.data,
    })

    return clinic
  })

  app.get('/clinics', async () => {
    const clinics = await prisma.clinic.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return clinics
  })

  app.get('/clinics/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const clinic = await prisma.clinic.findUnique({
      where: { id },
    })

    if (!clinic) {
      return reply.status(404).send({ error: 'Clinic not found' })
    }

    return clinic
  })
}
