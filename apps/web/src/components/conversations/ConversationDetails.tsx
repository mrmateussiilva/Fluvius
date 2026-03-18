import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { ConversationResponse } from '@fluvius/shared'

type ConversationDetailsProps = {
  conversation: ConversationResponse | null
}

function mapStatus(status: string): 'success' | 'warning' | 'muted' | 'default' {
  if (status === 'open') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'closed') return 'muted'
  return 'default'
}

function labelStatus(status: string): string {
  if (status === 'open') return 'Atendimento ativo'
  if (status === 'pending') return 'Atendimento pendente'
  if (status === 'closed') return 'Atendimento encerrado'
  return status
}

export function ConversationDetails({ conversation }: ConversationDetailsProps) {
  if (!conversation) {
    return (
      <div className="p-3">
        <EmptyState title="Sem seleção" description="Selecione uma conversa para ver os detalhes." />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 text-sm">
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nome do Cliente</p>
          <p className="text-sm font-semibold text-slate-900">{conversation.customerName || 'Não informado'}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">WhatsApp</p>
          <p className="text-sm font-semibold text-slate-900">{conversation.customerPhone}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Responsável</p>
          <p className="text-sm font-semibold text-slate-900">{conversation.assignedUser?.name || 'Não atribuído'}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status da Conversa</p>
          <Badge variant={mapStatus(conversation.status)}>{labelStatus(conversation.status)}</Badge>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Histórico</p>
        <p className="text-xs text-slate-500 italic">Conversas iniciada em {new Date(conversation.createdAt).toLocaleDateString()}</p>
      </div>
    </div>
  )
}
