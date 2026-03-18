import { MessageResponse } from '@fluvius/shared'

type MessageBubbleProps = {
  message: MessageResponse
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isCliente = message.direction === 'inbound'
  const alignment = isCliente ? 'justify-start' : 'justify-end'
  const bubbleClasses = isCliente
    ? 'bg-white text-slate-800 border border-slate-200'
    : 'bg-emerald-600 text-white'
  const timeClasses = isCliente ? 'text-slate-400' : 'text-emerald-100'

  return (
    <div className={`flex ${alignment}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${bubbleClasses}`}>
        <p className="leading-relaxed">{message.content}</p>
        <p className={`mt-1 text-[10px] font-medium ${timeClasses}`}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
