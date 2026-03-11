type Message = {
  id: string
  direction: string
  content: string
  createdAt: string
}

type MessageBubbleProps = {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isInbound = message.direction === 'inbound'

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
          isInbound ? 'bg-white text-slate-800 border border-slate-200' : 'bg-slate-900 text-white'
        }`}
      >
        <p>{message.content}</p>
        <p className={`mt-1 text-[11px] ${isInbound ? 'text-slate-400' : 'text-slate-300'}`}>
          {new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
