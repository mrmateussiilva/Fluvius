import { EmptyState } from '../ui/EmptyState'
import { MessageBubble } from './MessageBubble'
import { MockMessage } from '../../mocks/messages'

type ChatWindowProps = {
  messages: MockMessage[]
  loading?: boolean
  error?: string | null
  hasConversationSelected: boolean
}

export function ChatWindow({ messages, loading, error, hasConversationSelected }: ChatWindowProps) {
  if (!hasConversationSelected) {
    return (
      <div className="p-4">
        <EmptyState title="Selecione uma conversa para visualizar as mensagens." />
      </div>
    )
  }

  if (loading) {
    return <p className="p-4 text-sm text-slate-500">Carregando mensagens...</p>
  }

  if (error) {
    return <p className="p-4 text-sm text-red-600">{error}</p>
  }

  if (!messages.length) {
    return (
      <div className="p-4">
        <EmptyState title="Sem mensagens" description="Essa conversa ainda não possui mensagens." />
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  )
}
