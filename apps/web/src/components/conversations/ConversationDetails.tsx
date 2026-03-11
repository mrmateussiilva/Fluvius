import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { MockConversation } from '../../mocks/conversations'

type ConversationDetailsProps = {
  conversation: MockConversation | null
}

function mapStatus(status: string): 'success' | 'warning' | 'muted' | 'default' {
  if (status === 'ativo') return 'success'
  if (status === 'pendente') return 'warning'
  if (status === 'encerrado') return 'muted'
  return 'default'
}

function labelStatus(status: string): string {
  if (status === 'ativo') return 'Atendimento ativo'
  if (status === 'pendente') return 'Atendimento pendente'
  if (status === 'encerrado') return 'Atendimento encerrado'
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
    <div className="space-y-4 p-4 text-sm">
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Nome</p>
        <p className="text-slate-900">{conversation.name}</p>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Telefone</p>
        <p className="text-slate-900">{conversation.phone}</p>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Responsavel</p>
        <p className="text-slate-900">{conversation.assignedTo}</p>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Status</p>
        <Badge variant={mapStatus(conversation.status)}>{labelStatus(conversation.status)}</Badge>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Tags</p>
        <div className="flex flex-wrap gap-2">
          {conversation.tags.map((tag) => (
            <Badge key={tag} variant="default">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
