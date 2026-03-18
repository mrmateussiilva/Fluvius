import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SummaryStatCard } from '../components/team-board/SummaryStatCard'
import { BoardColumn } from '../components/team-board/BoardColumn'
import { SellerCard } from '../components/team-board/SellerCard'
import { Users, Wifi, MessageCircle, CheckCircle2 } from 'lucide-react'
import { userApi } from '../lib/api'
import { AttendantStatsResponse } from '@fluvius/shared'

const columnConfig: Array<{ key: string; title: string }> = [
  { key: 'online', title: 'Online agora' },
  { key: 'atendimento', title: 'Em atendimento' },
  { key: 'produtivo', title: 'Produtivos' },
  { key: 'offline', title: 'Pausa/Offline' },
]

export function TeamBoardPage() {
  const { data: attendants = [], isLoading } = useQuery({
    queryKey: ['attendants', 'stats'],
    queryFn: () => userApi.getAttendantsStats(),
  })

  const stats = useMemo(() => ({
    total: attendants.length,
    online: attendants.filter((a) => a.online).length,
    active: attendants.reduce((acc, a) => acc + a.activeChats, 0),
    closed: attendants.reduce((acc, a) => acc + a.closedToday, 0),
  }), [attendants])

  const getColumnAttendants = (key: string): AttendantStatsResponse[] => {
    if (key === 'online') return attendants.filter(a => a.online && a.activeChats === 0)
    if (key === 'atendimento') return attendants.filter(a => a.activeChats > 0)
    if (key === 'produtivo') return attendants.filter(a => a.closedToday > 2)
    if (key === 'offline') return attendants.filter(a => !a.online)
    return []
  }

  return (
    <section className="space-y-6 text-slate-900">
      <header className="flex flex-col gap-2 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/50 to-white p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold">Painel da Equipe</h2>
          <p className="mt-1 text-sm text-slate-600">Monitore o desempenho e a carga de trabalho dos seus atendentes em tempo real.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard
          title="Total de atendentes"
          value={stats.total}
          hint="Equipe cadastrada"
          icon={Users}
          colorClass="text-blue-600"
        />
        <SummaryStatCard
          title="Online agora"
          value={stats.online}
          hint="Disponíveis no momento"
          icon={Wifi}
          colorClass="text-emerald-600"
        />
        <SummaryStatCard
          title="Conversas ativas"
          value={stats.active}
          hint="Em andamento"
          icon={MessageCircle}
          colorClass="text-orange-600"
        />
        <SummaryStatCard
          title="Fechamentos hoje"
          value={stats.closed}
          hint="Resultado diário"
          icon={CheckCircle2}
          colorClass="text-purple-600"
        />
      </div>

      <div className="overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex h-[calc(100vh-21rem)] gap-4 min-h-[450px]">
          {isLoading ? (
            <p className="p-4 text-sm text-slate-500 italic">Carregando painel da equipe...</p>
          ) : (
            columnConfig.map((column) => {
              const columnAttendants = getColumnAttendants(column.key)

              return (
                <BoardColumn key={column.key} title={column.title} count={columnAttendants.length}>
                  {columnAttendants.map((seller) => (
                    <SellerCard key={seller.id} seller={seller} />
                  ))}
                </BoardColumn>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
