import { sellersMock, Seller, SellerStatusColumn } from '../mocks/sellers'
import { SummaryStatCard } from '../components/team-board/SummaryStatCard'
import { BoardColumn } from '../components/team-board/BoardColumn'
import { SellerCard } from '../components/team-board/SellerCard'

const columnConfig: Array<{ key: SellerStatusColumn; title: string }> = [
  { key: 'novos_leads', title: 'Novos leads' },
  { key: 'em_atendimento', title: 'Em atendimento' },
  { key: 'aguardando_retorno', title: 'Aguardando retorno' },
  { key: 'fechado', title: 'Fechado' },
  { key: 'perdido', title: 'Perdido' },
]

function getColumnSellers(statusColumn: SellerStatusColumn): Seller[] {
  return sellersMock.filter((seller) => seller.statusColumn === statusColumn)
}

export function TeamBoardPage() {
  const totalAttendants = sellersMock.length
  const onlineNow = sellersMock.filter((seller) => seller.online).length
  const activeChats = sellersMock.reduce((acc, seller) => acc + seller.activeChats, 0)
  const closedToday = sellersMock.reduce((acc, seller) => acc + seller.closedToday, 0)

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Painel de Atendimento</h2>
        <p className="mt-1 text-sm text-slate-600">Visao geral da equipe comercial e do andamento dos atendimentos</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard title="Total de atendentes" value={totalAttendants} hint="Equipe cadastrada" />
        <SummaryStatCard title="Online agora" value={onlineNow} hint="Disponiveis no momento" />
        <SummaryStatCard title="Conversas ativas" value={activeChats} hint="Em andamento" />
        <SummaryStatCard title="Fechamentos hoje" value={closedToday} hint="Resultado diario" />
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4">
          {columnConfig.map((column) => {
            const sellers = getColumnSellers(column.key)

            return (
              <BoardColumn key={column.key} title={column.title} count={sellers.length}>
                {sellers.map((seller) => (
                  <SellerCard key={seller.id} seller={seller} />
                ))}
              </BoardColumn>
            )
          })}
        </div>
      </div>
    </section>
  )
}
