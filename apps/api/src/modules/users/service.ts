import { prisma } from '../../lib/prisma.js'

export const userService = {
  async create(data: { clinicId: string; name: string; email: string; passwordHash: string; role?: 'admin' | 'attendant' }) {
    const { clinicId, ...rest } = data
    return prisma.user.create({
      data: {
        ...rest,
        clinic: { connect: { id: clinicId } },
      },
    })
  },

  async findMany(clinicId?: string) {
    return prisma.user.findMany({
      where: clinicId ? { clinicId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
  },

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } })
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  async getAttendantsStats(clinicId?: string) {
    const users = await prisma.user.findMany({
      where: {
        ...(clinicId && { clinicId }),
        role: 'attendant',
      },
      include: {
        conversations: {
          select: {
            status: true,
            createdAt: true,
          },
        },
      },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return users.map((user) => {
      const activeChats = user.conversations.filter((c) => c.status === 'open').length
      const leadsToday = user.conversations.filter((c) => c.createdAt >= today).length
      const closedToday = user.conversations.filter((c) => c.status === 'closed' && c.createdAt >= today).length

      return {
        id: user.id,
        clinicId: user.clinicId,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        online: true, // TODO: Implement real online status
        activeChats,
        leadsToday,
        closedToday,
        averageResponseTime: '2 min', // TODO: Implement calculation
        tags: user.role === 'admin' ? ['admin'] : ['vendas'],
        lastUpdate: 'agora',
      }
    })
  },
}
