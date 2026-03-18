export type ConversationResponse = {
    id: string
    clinicId: string
    customerName: string | null
    customerPhone: string
    assignedUserId: string | null
    status: 'open' | 'pending' | 'closed'
    createdAt: Date | string
    updatedAt: Date | string
    assignedUser?: {
        id: string
        name: string
        email: string
    } | null
}
