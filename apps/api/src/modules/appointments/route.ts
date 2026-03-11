import type { FastifyInstance } from 'fastify'
import { appointmentSchemas } from './schema.js'
import { appointmentService } from './service.js'

export async function appointmentRoutes(app: FastifyInstance) {
  app.post('/appointments', async (request, reply) => {
    const parsed = appointmentSchemas.create.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const { date, ...data } = parsed.data

    const appointment = await appointmentService.create({
      ...data,
      date: new Date(date),
    })

    return appointment
  })

  app.get('/appointments', async (request) => {
    const { clinicId } = request.query as { clinicId?: string }
    return appointmentService.findMany(clinicId)
  })

  app.get('/appointments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const appointment = await appointmentService.findById(id)

    if (!appointment) {
      return reply.status(404).send({ error: 'Appointment not found' })
    }

    return appointment
  })
}
