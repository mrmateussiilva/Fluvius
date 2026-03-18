import type { FastifyInstance } from 'fastify'
import { userSchemas } from './schema.js'
import { userService } from './service.js'

export async function userRoutes(app: FastifyInstance) {
  app.post('/users', async (request, reply) => {
    const parsed = userSchemas.create.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const { password, ...data } = parsed.data

    const user = await userService.create({
      ...data,
      passwordHash: password,
    })

    return user
  })

  app.get('/users/attendants/stats', async (request) => {
    const { clinicId } = request.query as { clinicId?: string }
    return userService.getAttendantsStats(clinicId)
  })

  app.get('/users', async (request) => {
    const { clinicId } = request.query as { clinicId?: string }
    return userService.findMany(clinicId)
  })

  app.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = await userService.findById(id)

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return user
  })
}
