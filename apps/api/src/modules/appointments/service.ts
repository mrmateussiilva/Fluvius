import { prisma } from '../../lib/prisma.js'

export const appointmentService = {
  async create(data: { 
    clinicId: string; 
    conversationId: string; 
    serviceId: string; 
    customerName: string; 
    customerPhone: string; 
    date: Date; 
    status?: 'scheduled' | 'confirmed' | 'canceled' | 'completed' 
  }) {
    const { clinicId, conversationId, serviceId, ...rest } = data
    return prisma.appointment.create({
      data: {
        ...rest,
        clinic: { connect: { id: clinicId } },
        conversation: { connect: { id: conversationId } },
        service: { connect: { id: serviceId } },
      },
      include: {
        service: true,
      },
    })
  },

  async findMany(clinicId?: string) {
    return prisma.appointment.findMany({
      where: clinicId ? { clinicId } : undefined,
      orderBy: { date: 'asc' },
      include: {
        service: true,
      },
    })
  },

  async findById(id: string) {
    return prisma.appointment.findUnique({
      where: { id },
      include: {
        service: true,
      },
    })
  },
}
