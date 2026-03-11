import { useMemo, useState } from 'react'
import { Card } from '../components/ui/Card'
import { ConversationList } from '../components/conversations/ConversationList'
import { ChatWindow } from '../components/conversations/ChatWindow'
import { ConversationDetails } from '../components/conversations/ConversationDetails'
import { mockedConversations } from '../mocks/conversations'
import { mockedMessages } from '../mocks/messages'

export function ConversationsPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  const conversations = mockedConversations

  const selectedConversation = useMemo(() => {
    return conversations.find((conversation) => conversation.id === selectedConversationId) || null
  }, [conversations, selectedConversationId])

  const messages = useMemo(() => {
    if (!selectedConversationId) return []
    return mockedMessages.find((entry) => entry.conversationId === selectedConversationId)?.messages || []
  }, [selectedConversationId])

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
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-3 py-2">
            <p className="text-sm font-medium text-slate-900">Detalhes</p>
          </div>
          <ConversationDetails conversation={selectedConversation} />
        </Card>
      </div>
    </section>
  )
}
