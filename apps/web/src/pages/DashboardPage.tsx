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
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Fluvius</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Logout
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-700">Conversas</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="p-4 text-gray-500">Carregando...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-gray-500">Nenhuma conversa</div>
            ) : (
              conversations.map((conv: Conversation) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedConversationId === conv.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">
                        {conv.customerName || conv.customerPhone}
                      </p>
                      <p className="text-sm text-gray-500">{conv.customerPhone}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      conv.status === 'open' ? 'bg-green-100 text-green-800' :
                      conv.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {conv.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          {selectedConversationId ? (
            <>
              <div className="p-4 bg-white border-b border-gray-200">
                <h2 className="font-semibold text-gray-800">
                  {selectedConversation?.customerName || selectedConversation?.customerPhone}
                </h2>
                <p className="text-sm text-gray-500">{selectedConversation?.customerPhone}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="text-gray-500">Carregando mensagens...</div>
                ) : messages.length === 0 ? (
                  <div className="text-gray-500">Nenhuma mensagem</div>
                ) : (
                  messages.map((msg: Message) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.direction === 'inbound'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-600 text-white'
                      }`}>
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.direction === 'inbound' ? 'text-gray-500' : 'text-blue-200'
                        }`}>
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Selecione uma conversa
            </div>
          )}
        </main>

        <aside className="w-72 bg-white border-l border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Detalhes</h3>
          {selectedConversation ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-gray-800 capitalize">{selectedConversation.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Atendente</p>
                <p className="text-gray-800">
                  {selectedConversation.assignedUser?.name || 'Não atribuído'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Selecione uma conversa para ver os detalhes</p>
          )}
        </aside>
      </div>
    </div>
  )
}
