import { prisma } from '../../lib/prisma.js'

export const dashboardService = {
    async getStats(clinicId?: string) {
        const where = clinicId ? { clinicId } : {}

        const [conversations, services, appointments] = await Promise.all([
            prisma.conversation.count({ where }),
            prisma.service.count({ where }),
            prisma.appointment.count({ where }),
        ])

        return {
            conversations,
            services,
            appointments,
        }
    },
}
