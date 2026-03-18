import { AttendantStatsResponse } from '@fluvius/shared'
import { StatusBadge } from './StatusBadge'
import { TagChip } from './TagChip'
import { MessageCircle, Target, TrendingUp, Clock } from 'lucide-react'

type SellerCardProps = {
  seller: AttendantStatsResponse
}

export function SellerCard({ seller }: SellerCardProps) {
  const initials = seller.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <article className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 ring-2 ring-white">
              {initials}
            </div>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{seller.name}</p>
            <p className="truncate text-[11px] text-slate-500 font-medium">{seller.email}</p>
          </div>
        </div>
        <StatusBadge online={seller.online} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-slate-50/50 p-2 border border-slate-100/50">
          <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
            <MessageCircle className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-tight">Ativas</span>
          </div>
          <p className="text-sm font-bold text-slate-800">{seller.activeChats}</p>
        </div>

        <div className="rounded-lg bg-slate-50/50 p-2 border border-slate-100/50">
          <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
            <Target className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-tight">Novos</span>
          </div>
          <p className="text-sm font-bold text-slate-800">{seller.leadsToday}</p>
        </div>

        <div className="rounded-lg bg-emerald-50/30 p-2 border border-emerald-100/30">
          <div className="flex items-center gap-1.5 text-emerald-400 mb-0.5">
            <TrendingUp className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-tight">Vendas</span>
          </div>
          <p className="text-sm font-bold text-emerald-700">{seller.closedToday}</p>
        </div>

        <div className="rounded-lg bg-slate-50/50 p-2 border border-slate-100/50">
          <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
            <Clock className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-tight">Rápido</span>
          </div>
          <p className="text-sm font-bold text-slate-800">{seller.averageResponseTime}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {seller.tags.map((tag) => (
          <TagChip key={tag} label={tag} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
        <span className="text-[10px] font-medium text-slate-400 italic">Atualizado {seller.lastUpdate}</span>
      </div>
    </article>
  )
}
