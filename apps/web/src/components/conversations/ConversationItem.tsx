import { Badge } from '../ui/Badge'

type Conversation = {
  id: string
  customerName: string | null
  customerPhone: string
  status: string
}

type ConversationItemProps = {
  conversation: Conversation
  selected: boolean
  onSelect: (id: string) => void
}

function mapStatus(status: string): 'success' | 'warning' | 'muted' | 'default' {
  if (status === 'open') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'closed') return 'muted'
  return 'default'
}

export function ConversationItem({ conversation, selected, onSelect }: ConversationItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`w-full border-b border-slate-100 px-3 py-3 text-left transition-colors ${
        selected ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <p className="truncate text-sm font-medium text-slate-900">
          {conversation.customerName || conversation.customerPhone}
        </p>
        <Badge variant={mapStatus(conversation.status)}>{conversation.status}</Badge>
      </div>
      <p className="text-xs text-slate-500">{conversation.customerPhone}</p>
    </button>
  )
}
