import type { FastifyInstance } from 'fastify'
import { dashboardSchemas } from './schema.js'
import { dashboardService } from './service.js'

export async function dashboardRoutes(app: FastifyInstance) {
    app.get('/dashboard/stats', async (request, reply) => {
        const parsed = dashboardSchemas.statsQuery.safeParse(request.query)

        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Validation error',
                details: parsed.error.flatten(),
            })
        }

        return dashboardService.getStats(parsed.data.clinicId)
    })
}
