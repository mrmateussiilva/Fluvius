import { useRef, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '../ui/EmptyState'
import { MessageBubble } from './MessageBubble'
import { MessageResponse } from '@fluvius/shared'
import { messageApi } from '../../lib/api'

type ChatWindowProps = {
  messages: MessageResponse[]
  loading?: boolean
  error?: string | null
  hasConversationSelected: boolean
  conversationId: string | null
}

export function ChatWindow({ messages, loading, error, hasConversationSelected, conversationId }: ChatWindowProps) {
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (content: string) =>
      messageApi.create({ conversationId: conversationId!, direction: 'outbound', content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      setText('')
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || !conversationId || mutation.isPending) return
    mutation.mutate(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

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

  return (
    <div className="flex flex-col h-full">
      {/* Área de mensagens com scroll interno */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sem mensagens" description="Essa conversa ainda não possui mensagens." />
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Rodapé fixo com input */}
      <div className="border-t border-slate-100 bg-white p-3 flex flex-col gap-1">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            rows={2}
            placeholder="Digite uma mensagem... (Enter para enviar, Shift+Enter para quebrar linha)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={mutation.isPending}
          />
          <button
            onClick={handleSend}
            disabled={mutation.isPending || !text.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-600">
            Erro ao enviar mensagem: {(mutation.error as Error)?.message ?? 'Tente novamente.'}
          </p>
        )}
      </div>
    </div>
  )
}
