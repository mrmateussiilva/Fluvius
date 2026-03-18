import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.js'

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhook/evolution', async (request, reply) => {
    // Sempre retorna 200 para a Evolution API
    reply.status(200).send({ ok: true })

    try {
      const body = request.body as Record<string, unknown>

      // Processa apenas o evento "messages.upsert"
      if (body.event !== 'messages.upsert') return

      const data = body.data as Record<string, unknown> | undefined
      if (!data) return

      const key = data.key as Record<string, unknown> | undefined
      if (!key) return

      const remoteJid = key.remoteJid as string | undefined
      const fromMe = key.fromMe as boolean | undefined

      // Descarta grupos, broadcast e mensagens enviadas pelo próprio bot
      if (!remoteJid) return
      if (remoteJid.includes('@g.us') || remoteJid.includes('@broadcast')) return
      if (fromMe === true) return

      // Extrai o número de telefone
      const phone = remoteJid.replace('@s.whatsapp.net', '')

      // Extrai o texto da mensagem
      const messageObj = data.message as Record<string, unknown> | undefined
      const text: string | null =
        (messageObj?.conversation as string | undefined) ??
        ((messageObj?.extendedTextMessage as Record<string, unknown> | undefined)?.text as string | undefined) ??
        null

      const pushName = (data.pushName as string | undefined) ?? null

      // Busca a conversa mais recente com esse telefone
      let conversation = await prisma.conversation.findFirst({
        where: { customerPhone: phone },
        orderBy: { createdAt: 'desc' },
      })

      // Se não existir, cria uma nova conversa vinculada à primeira clínica
      if (!conversation) {
        const clinic = await prisma.clinic.findFirst()
        if (!clinic) {
          app.log.warn('[webhook] Nenhuma clínica encontrada no banco. Mensagem descartada.')
          return
        }

        conversation = await prisma.conversation.create({
          data: {
            clinicId: clinic.id,
            customerPhone: phone,
            customerName: pushName,
            status: 'open',
          },
        })
      }

      // Salva a mensagem se houver texto
      if (text !== null) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: 'inbound',
            content: text,
          },
        })
      }

      // Atualiza o updatedAt da conversa
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      })
    } catch (err) {
      app.log.error({ err }, '[webhook] Erro ao processar evento da Evolution API')
    }
  })
}
