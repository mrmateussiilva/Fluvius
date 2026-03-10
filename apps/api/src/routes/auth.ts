import { FastifyInstance } from 'fastify'
import { loginSchema } from '@fluvius/shared'

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const { email, password: _password } = parsed.data

    return {
      message: 'Login successful',
      user: {
        email,
      },
    }
  })
}
