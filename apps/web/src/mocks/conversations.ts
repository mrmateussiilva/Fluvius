export type MockConversationStatus = 'ativo' | 'pendente' | 'encerrado'

export type MockConversation = {
  id: string
  name: string
  phone: string
  lastMessage: string
  time: string
  assignedTo: string
  status: MockConversationStatus
  tags: string[]
}

export const mockedConversations: MockConversation[] = [
  {
    id: '1',
    name: 'Maria Silva',
    phone: '+55 11 99999-0001',
    lastMessage: 'Olá, gostaria de agendar uma consulta.',
    time: '10:32',
    assignedTo: 'Ana',
    status: 'ativo',
    tags: ['Novo lead', 'Limpeza'],
  },
  {
    id: '2',
    name: 'João Santos',
    phone: '+55 11 98888-0012',
    lastMessage: 'Pode confirmar meu horário de amanhã?',
    time: '10:11',
    assignedTo: 'Carlos',
    status: 'pendente',
    tags: ['Retorno', 'Orçamento'],
  },
  {
    id: '3',
    name: 'Carla Oliveira',
    phone: '+55 21 97777-0023',
    lastMessage: 'Recebi o lembrete, estarei aí às 14h.',
    time: '09:48',
    assignedTo: 'Ana',
    status: 'ativo',
    tags: ['Confirmado'],
  },
  {
    id: '4',
    name: 'Pedro Costa',
    phone: '+55 31 96666-0034',
    lastMessage: 'Obrigado pelo atendimento!',
    time: 'Ontem',
    assignedTo: 'Bruna',
    status: 'encerrado',
    tags: ['Finalizado'],
  },
  {
    id: '5',
    name: 'Ana Santos',
    phone: '+55 41 95555-0045',
    lastMessage: 'Quais formas de pagamento vocês aceitam?',
    time: '08:57',
    assignedTo: 'Carlos',
    status: 'ativo',
    tags: ['Financeiro'],
  },
]
