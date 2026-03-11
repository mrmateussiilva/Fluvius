import { prisma } from '../../lib/prisma.js'

export const conversationService = {
  async create(data: { 
    clinicId: string; 
    customerPhone: string; 
    customerName?: string; 
    assignedUserId?: string; 
    status?: 'open' | 'pending' | 'closed' 
  }) {
    const { clinicId, assignedUserId, ...rest } = data
    return prisma.conversation.create({
      data: {
        ...rest,
        clinic: { connect: { id: clinicId } },
        ...(assignedUserId && { assignedUser: { connect: { id: assignedUserId } } }),
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    })
  },

  async findMany(clinicId?: string, status?: string) {
    return prisma.conversation.findMany({
      where: {
        ...(clinicId && { clinicId }),
        ...(status && { status: status as any }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    })
  },

  async findById(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    })
  },
}
