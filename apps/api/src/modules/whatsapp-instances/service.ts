import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { evolutionClient } from '../../integrations/evolution/evolution.client.js'
import { prisma } from '../../lib/prisma.js'

type WhatsAppInstanceRow = {
  id: string
  clinicId: string
  externalId: string
  provider: string
  status: string
  qrCode: string | null
  phone: string | null
  createdAt: Date
  updatedAt: Date
}

const whatsappInstanceSelect = Prisma.sql`
  "id", "clinicId", "externalId", "provider", "status", "qrCode", "phone", "createdAt", "updatedAt"
`

export const whatsappInstanceService = {
  async create(data: { clinicId: string }) {
    const clinic = await prisma.clinic.findUnique({ where: { id: data.clinicId } })

    if (!clinic) {
      throw new Error('Clinic not found')
    }

    const instanceName = `clinic_${data.clinicId}`
    const evolutionInstance = await evolutionClient.createInstance({ instanceName })
    const id = randomUUID()

    const rows = await prisma.$queryRaw<WhatsAppInstanceRow[]>`
      INSERT INTO "whatsapp_instances" (
        "id", "clinicId", "externalId", "provider", "status", "qrCode", "phone", "createdAt", "updatedAt"
      ) VALUES (
        ${id},
        ${data.clinicId},
        ${evolutionInstance.externalId},
        ${'evolution'},
        ${evolutionInstance.status || 'pending'},
        ${evolutionInstance.qrCode || null},
        ${evolutionInstance.phone || null},
        NOW(),
        NOW()
      )
      RETURNING ${whatsappInstanceSelect}
    `

    return rows[0]
  },

  async list(clinicId?: string) {
    const where = clinicId ? Prisma.sql`WHERE "clinicId" = ${clinicId}` : Prisma.empty

    return prisma.$queryRaw<WhatsAppInstanceRow[]>`
      SELECT ${whatsappInstanceSelect}
      FROM "whatsapp_instances"
      ${where}
      ORDER BY "createdAt" DESC
    `
  },

  async findById(id: string) {
    const rows = await prisma.$queryRaw<WhatsAppInstanceRow[]>`
      SELECT ${whatsappInstanceSelect}
      FROM "whatsapp_instances"
      WHERE "id" = ${id}
      LIMIT 1
    `

    return rows[0] || null
  },

  async getQrCode(id: string) {
    const instance = await this.findById(id)

    if (!instance) {
      return null
    }

    const qr = await evolutionClient.getInstanceQrCode(instance.externalId)

    const rows = await prisma.$queryRaw<WhatsAppInstanceRow[]>`
      UPDATE "whatsapp_instances"
      SET "qrCode" = ${qr.qrCode || instance.qrCode}, "updatedAt" = NOW()
      WHERE "id" = ${instance.id}
      RETURNING ${whatsappInstanceSelect}
    `

    const updated = rows[0]

    return {
      id: updated.id,
      qrCode: updated.qrCode,
      externalId: updated.externalId,
    }
  },

  async getStatus(id: string) {
    const instance = await this.findById(id)

    if (!instance) {
      return null
    }

    const statusResult = await evolutionClient.getInstanceStatus(instance.externalId)

    const rows = await prisma.$queryRaw<WhatsAppInstanceRow[]>`
      UPDATE "whatsapp_instances"
      SET "status" = ${statusResult.status}, "updatedAt" = NOW()
      WHERE "id" = ${instance.id}
      RETURNING ${whatsappInstanceSelect}
    `

    const updated = rows[0]

    return {
      id: updated.id,
      status: updated.status,
      externalId: updated.externalId,
    }
  },
}
