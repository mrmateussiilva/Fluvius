export type MockMessageSender = 'cliente' | 'bot' | 'atendente'

export type MockMessage = {
  id: string
  sender: MockMessageSender
  text: string
  time: string
}

export type MockConversationMessages = {
  conversationId: string
  messages: MockMessage[]
}

export const mockedMessages: MockConversationMessages[] = [
  {
    conversationId: '1',
    messages: [
      { id: 'm1', sender: 'cliente', text: 'Olá, gostaria de agendar uma consulta.', time: '10:32' },
      { id: 'm2', sender: 'bot', text: 'Claro! Qual serviço você deseja?', time: '10:32' },
      { id: 'm3', sender: 'cliente', text: 'Limpeza.', time: '10:33' },
      { id: 'm4', sender: 'atendente', text: 'Temos horários amanhã às 14h ou 16h.', time: '10:34' },
    ],
  },
  {
    conversationId: '2',
    messages: [
      { id: 'm5', sender: 'cliente', text: 'Pode confirmar meu horário de amanhã?', time: '10:11' },
      { id: 'm6', sender: 'atendente', text: 'Confirmado para às 09h com a Dra. Paula.', time: '10:13' },
    ],
  },
  {
    conversationId: '3',
    messages: [
      { id: 'm7', sender: 'bot', text: 'Lembrete: sua consulta é hoje às 14h.', time: '09:40' },
      { id: 'm8', sender: 'cliente', text: 'Recebi o lembrete, estarei aí às 14h.', time: '09:48' },
    ],
  },
  {
    conversationId: '4',
    messages: [
      { id: 'm9', sender: 'cliente', text: 'Obrigado pelo atendimento!', time: '18:20' },
      { id: 'm10', sender: 'atendente', text: 'Nós que agradecemos. Até a próxima!', time: '18:21' },
    ],
  },
  {
    conversationId: '5',
    messages: [
      { id: 'm11', sender: 'cliente', text: 'Quais formas de pagamento vocês aceitam?', time: '08:57' },
      { id: 'm12', sender: 'bot', text: 'Aceitamos PIX, cartão e dinheiro.', time: '08:58' },
      { id: 'm13', sender: 'atendente', text: 'Se preferir, também parcelamos no cartão.', time: '09:00' },
    ],
  },
]
