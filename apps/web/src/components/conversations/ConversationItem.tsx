import { ConversationResponse } from '@fluvius/shared'

type ConversationItemProps = {
  conversation: ConversationResponse
  selected: boolean
  onSelect: (id: string) => void
}

export function ConversationItem({ conversation, selected, onSelect }: ConversationItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`w-full border-b border-slate-100 px-4 py-4 text-left transition-colors ${selected ? 'bg-emerald-50 text-emerald-900' : 'bg-white hover:bg-slate-50'
        }`}
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <p className="truncate text-sm font-semibold">{conversation.customerName || 'Cliente sem nome'}</p>
        <p className="shrink-0 text-[10px] text-slate-400 font-medium">
          {new Date(conversation.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <p className="truncate text-xs text-slate-500 font-medium">{conversation.customerPhone}</p>
    </button>
  )
}
