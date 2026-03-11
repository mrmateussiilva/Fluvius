import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'

type Conversation = {
  id: string
  customerName: string | null
  customerPhone: string
  status: string
  assignedUserId?: string | null
}

type ConversationDetailsProps = {
  conversation: Conversation | null
}

function mapStatus(status: string): 'success' | 'warning' | 'muted' | 'default' {
  if (status === 'open') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'closed') return 'muted'
  return 'default'
}

export function ConversationDetails({ conversation }: ConversationDetailsProps) {
  if (!conversation) {
    return (
      <div className="p-3">
        <EmptyState title="Sem seleção" description="Selecione uma conversa para ver os detalhes." />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 text-sm">
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">customerName</p>
        <p className="text-slate-900">{conversation.customerName || '-'}</p>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">customerPhone</p>
        <p className="text-slate-900">{conversation.customerPhone}</p>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">status</p>
        <Badge variant={mapStatus(conversation.status)}>{conversation.status}</Badge>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">assignedUserId</p>
        <p className="text-slate-900">{conversation.assignedUserId || '-'}</p>
      </div>
    </div>
  )
}
