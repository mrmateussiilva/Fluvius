import { prisma } from '../../lib/prisma.js'

export const clinicService = {
  async create(data: { name: string; slug: string }) {
    return prisma.clinic.create({ data })
  },

  async findMany() {
    return prisma.clinic.findMany({
      orderBy: { createdAt: 'desc' },
    })
  },

  async findById(id: string) {
    return prisma.clinic.findUnique({ where: { id } })
  },
}
