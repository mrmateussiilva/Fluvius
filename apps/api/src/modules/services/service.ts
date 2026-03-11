import { prisma } from '../../lib/prisma.js'

export const serviceService = {
  async create(data: { clinicId: string; name: string; price: number; durationMinutes: number; active?: boolean }) {
    const { clinicId, ...rest } = data
    return prisma.service.create({
      data: {
        ...rest,
        clinic: { connect: { id: clinicId } },
      },
    })
  },

  async findMany(clinicId?: string) {
    return prisma.service.findMany({
      where: clinicId ? { clinicId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
  },

  async findById(id: string) {
    return prisma.service.findUnique({ where: { id } })
  },
}
