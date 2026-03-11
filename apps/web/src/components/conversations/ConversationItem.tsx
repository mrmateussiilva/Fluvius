import { MockConversation } from '../../mocks/conversations'

type ConversationItemProps = {
  conversation: MockConversation
  selected: boolean
  onSelect: (id: string) => void
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
        <p className="truncate text-sm font-medium text-slate-900">{conversation.name}</p>
        <p className="shrink-0 text-xs text-slate-500">{conversation.time}</p>
      </div>
      <p className="truncate text-xs text-slate-500">{conversation.lastMessage}</p>
    </button>
  )
}
