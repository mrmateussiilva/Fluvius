import { MockMessage } from '../../mocks/messages'

type MessageBubbleProps = {
  message: MockMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isCliente = message.sender === 'cliente'
  const isBot = message.sender === 'bot'
  const alignment = isBot ? 'justify-center' : isCliente ? 'justify-start' : 'justify-end'
  const bubbleClasses = isBot
    ? 'bg-amber-50 text-amber-900 border border-amber-200'
    : isCliente
      ? 'bg-white text-slate-800 border border-slate-200'
      : 'bg-slate-900 text-white'
  const timeClasses = isBot ? 'text-amber-700' : isCliente ? 'text-slate-400' : 'text-slate-300'

  return (
    <div className={`flex ${alignment}`}>
      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${bubbleClasses}`}>
        <p>{message.text}</p>
        <p className={`mt-1 text-[11px] ${timeClasses}`}>{message.time}</p>
      </div>
    </div>
  )
}
