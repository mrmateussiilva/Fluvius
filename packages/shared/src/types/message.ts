export type MessageResponse = {
    id: string
    conversationId: string
    direction: 'inbound' | 'outbound'
    content: string
    createdAt: Date | string
}
