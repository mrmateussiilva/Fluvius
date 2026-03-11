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
}
