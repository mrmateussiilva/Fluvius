import { ConversationItem } from './ConversationItem'
import { EmptyState } from '../ui/EmptyState'
import { MockConversation } from '../../mocks/conversations'

type ConversationListProps = {
  conversations: MockConversation[]
  selectedConversationId: string | null
  loading?: boolean
  error?: string | null
  onSelect: (id: string) => void
}

export function ConversationList({
  conversations,
  selectedConversationId,
  loading,
  error,
  onSelect,
}: ConversationListProps) {
  if (loading) {
    return <p className="p-4 text-sm text-slate-500">Carregando conversas...</p>
  }

  if (error) {
    return <p className="p-4 text-sm text-red-600">{error}</p>
  }

  if (!conversations.length) {
    return <EmptyState title="Nenhuma conversa" description="Quando houver conversas, elas aparecerão aqui." />
  }

  return (
    <div className="overflow-y-auto">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          selected={selectedConversationId === conversation.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
