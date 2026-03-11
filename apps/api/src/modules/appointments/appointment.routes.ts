import { createAppointmentSchema } from '@fluvius/shared'
import { prisma } from '../../lib/prisma.js'
import type { FastifyInstance } from 'fastify'

export async function appointmentRoutes(app: FastifyInstance) {
  app.post('/appointments', async (request, reply) => {
    const parsed = createAppointmentSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const { date, ...data } = parsed.data

    const appointment = await prisma.appointment.create({
      data: {
        ...data,
        date: new Date(date),
      },
    })

    return appointment
  })

  app.get('/appointments', async (request) => {
    const { clinicId } = request.query as { clinicId?: string }
    
    const appointments = await prisma.appointment.findMany({
      where: clinicId ? { clinicId } : undefined,
      orderBy: { date: 'asc' },
      include: {
        service: true,
      },
    })
    return appointments
  })

  app.get('/appointments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        service: true,
      },
    })

    if (!appointment) {
      return reply.status(404).send({ error: 'Appointment not found' })
    }

    return appointment
  })
}
