import { Seller } from '../../mocks/sellers'
import { StatusBadge } from './StatusBadge'
import { TagChip } from './TagChip'

type SellerCardProps = {
  seller: Seller
}

export function SellerCard({ seller }: SellerCardProps) {
  return (
    <article className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
            {seller.avatarInitials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{seller.name}</p>
            <p className="truncate text-xs text-slate-500">{seller.phone}</p>
          </div>
        </div>
        <StatusBadge online={seller.online} />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-slate-500">Conversas ativas</dt>
          <dd className="font-semibold text-slate-800">{seller.activeChats}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Leads hoje</dt>
          <dd className="font-semibold text-slate-800">{seller.leadsToday}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Fechamentos</dt>
          <dd className="font-semibold text-emerald-700">{seller.closedToday}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Tempo medio</dt>
          <dd className="font-semibold text-slate-800">{seller.averageResponseTime}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {seller.tags.map((tag) => (
          <TagChip key={tag} label={tag} />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-slate-500">Atualizado {seller.lastUpdate}</p>
    </article>
  )
}
