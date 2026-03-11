import { prisma } from '../../lib/prisma.js'

export const messageService = {
  async create(data: { conversationId: string; direction: 'inbound' | 'outbound'; content: string }) {
    const { conversationId, ...rest } = data
    return prisma.message.create({
      data: {
        ...rest,
        conversation: { connect: { id: conversationId } },
      },
    })
  },

  async findByConversationId(conversationId: string) {
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })
  },
}
