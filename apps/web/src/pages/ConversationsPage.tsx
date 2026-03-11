import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { conversationApi, messageApi } from '../lib/api'
import { Card } from '../components/ui/Card'
import { ConversationList } from '../components/conversations/ConversationList'
import { ChatWindow } from '../components/conversations/ChatWindow'
import { ConversationDetails } from '../components/conversations/ConversationDetails'

type Conversation = {
  id: string
  clinicId: string
  customerName: string | null
  customerPhone: string
  status: string
  assignedUser: { id: string; name: string } | null
}

type Message = {
  id: string
  conversationId: string
  direction: string
  content: string
  createdAt: string
}

export function ConversationsPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationApi.list(),
  })

  const messagesQuery = useQuery({
    queryKey: ['messages', selectedConversationId],
    queryFn: () => messageApi.list(selectedConversationId as string),
    enabled: !!selectedConversationId,
  })

  const conversations = (conversationsQuery.data || []) as Conversation[]
  const messages = (messagesQuery.data || []) as Message[]

  const selectedConversation = useMemo(() => {
    return conversations.find((conversation) => conversation.id === selectedConversationId) || null
  }, [conversations, selectedConversationId])

  return (
    <section>
      <div className="grid h-[calc(100vh-10.5rem)] grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_280px]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-3 py-2">
            <p className="text-sm font-medium text-slate-900">Conversas</p>
          </div>
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            loading={conversationsQuery.isLoading}
            error={conversationsQuery.isError ? 'Erro ao carregar conversas.' : null}
            onSelect={setSelectedConversationId}
          />
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-3 py-2">
            <p className="text-sm font-medium text-slate-900">Mensagens</p>
          </div>
          <div className="h-[calc(100%-2.5rem)] overflow-y-auto bg-slate-50">
            <ChatWindow
              messages={messages}
              hasConversationSelected={!!selectedConversationId}
              loading={messagesQuery.isLoading}
              error={messagesQuery.isError ? 'Erro ao carregar mensagens.' : null}
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-3 py-2">
            <p className="text-sm font-medium text-slate-900">Detalhes</p>
          </div>
          <ConversationDetails
            conversation={
              selectedConversation
                ? {
                    id: selectedConversation.id,
                    customerName: selectedConversation.customerName,
                    customerPhone: selectedConversation.customerPhone,
                    status: selectedConversation.status,
                    assignedUserId: selectedConversation.assignedUser?.id || null,
                  }
                : null
            }
          />
        </Card>
      </div>
    </section>
  )
}
