import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../components/ui/Card'
import { ConversationList } from '../components/conversations/ConversationList'
import { ChatWindow } from '../components/conversations/ChatWindow'
import { ConversationDetails } from '../components/conversations/ConversationDetails'
import { conversationApi, messageApi } from '../lib/api'

export function ConversationsPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    error: conversationsError
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationApi.list(),
  })

  const selectedConversation = useMemo(() => {
    return conversations.find((conversation) => conversation.id === selectedConversationId) || null
  }, [conversations, selectedConversationId])

  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    error: messagesError
  } = useQuery({
    queryKey: ['messages', selectedConversationId],
    queryFn: () => (selectedConversationId ? messageApi.list(selectedConversationId) : Promise.resolve([])),
    enabled: !!selectedConversationId,
  })

  return (
    <section>
      <div className="grid h-[calc(100vh-10.5rem)] grid-cols-1 gap-4 lg:grid-cols-[300px_1fr_300px]">
        <Card className="flex flex-col overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/50">
            <p className="text-sm font-bold text-slate-900">Conversas</p>
          </div>
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            onSelect={setSelectedConversationId}
            loading={isLoadingConversations}
            error={conversationsError?.message}
          />
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/50">
            <p className="text-sm font-bold text-slate-900">Mensagens</p>
          </div>
          <div className="h-full bg-slate-50/30 flex flex-col">
            <ChatWindow
              messages={messages}
              hasConversationSelected={!!selectedConversationId}
              loading={isLoadingMessages}
              error={messagesError?.message}
              conversationId={selectedConversationId}
            />
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/50">
            <p className="text-sm font-bold text-slate-900">Detalhes do Cliente</p>
          </div>
          <ConversationDetails conversation={selectedConversation} />
        </Card>
      </div>
    </section>
  )
}
