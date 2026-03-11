import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { conversationApi, messageApi } from '../lib/api'

type Conversation = {
  id: string
  clinicId: string
  customerName: string | null
  customerPhone: string
  status: string
  assignedUser: { id: string; name: string } | null
}

type Message = {
  id: string
  conversationId: string
  direction: string
  content: string
  createdAt: string
}

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  closed: 'bg-gray-100 text-gray-700 border-gray-200',
}

export function DashboardPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationApi.list(),
  })

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['messages', selectedConversationId],
    queryFn: () => messageApi.list(selectedConversationId!),
    enabled: !!selectedConversationId,
  })

  const selectedConversation = conversations.find((c: Conversation) => c.id === selectedConversationId)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Fluvius</h1>
            <p className="text-xs text-gray-500">Conversas</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Sair
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-96 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-700">Conversas</h2>
            <p className="text-xs text-gray-500">{conversations.length} conversa(s)</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="p-4 text-gray-500 flex items-center justify-center">
                <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Carregando...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p>Nenhuma conversa encontrada</p>
              </div>
            ) : (
              conversations.map((conv: Conversation) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-all ${
                    selectedConversationId === conv.id ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-semibold text-gray-900 truncate">
                      {conv.customerName || conv.customerPhone}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full border ${statusColors[conv.status] || 'bg-gray-100 text-gray-700'}`}>
                      {conv.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{conv.customerPhone}</p>
                  {conv.assignedUser && (
                    <p className="text-xs text-gray-400 mt-1">@{conv.assignedUser.name}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-gray-50">
          {selectedConversationId ? (
            <>
              <div className="p-4 bg-white border-b border-gray-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900 text-lg">
                      {selectedConversation?.customerName || selectedConversation?.customerPhone}
                    </h2>
                    <p className="text-sm text-gray-500">{selectedConversation?.customerPhone}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full border ${statusColors[selectedConversation?.status || ''] || 'bg-gray-100'}`}>
                    {selectedConversation?.status}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Carregando...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Nenhuma mensagem nesta conversa
                  </div>
                ) : (
                  messages.map((msg: Message) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
                        msg.direction === 'inbound'
                          ? 'bg-white text-gray-800 rounded-tl-none'
                          : 'bg-primary-600 text-white rounded-tr-none'
                      }`}>
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.direction === 'inbound' ? 'text-gray-400' : 'text-primary-200'
                        }`}>
                          {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm">para começar a conversar</p>
              </div>
            </div>
          )}
        </main>

        <aside className="w-80 bg-white border-l border-gray-200 p-6">
          <h3 className="font-semibold text-gray-700 mb-6">Detalhes</h3>
          {selectedConversation ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Status</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border ${statusColors[selectedConversation.status] || 'bg-gray-100'}`}>
                  {selectedConversation.status}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Cliente</p>
                <p className="text-gray-900">{selectedConversation.customerName || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Telefone</p>
                <p className="text-gray-900">{selectedConversation.customerPhone}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Atendente</p>
                <p className="text-gray-900">{selectedConversation.assignedUser?.name || 'Não atribuído'}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Selecione uma conversa para ver os detalhes</p>
          )}
        </aside>
      </div>
    </div>
  )
}
