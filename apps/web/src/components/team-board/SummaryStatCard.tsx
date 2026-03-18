import { LucideIcon } from 'lucide-react'

type SummaryStatCardProps = {
  title: string
  value: string | number
  hint?: string
  icon: LucideIcon
  colorClass: string
}

export function SummaryStatCard({ title, value, hint, icon: Icon, colorClass }: SummaryStatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-[11px] font-medium text-slate-500">{hint}</p> : null}
        </div>
        <div className={`rounded-xl bg-slate-50 p-3 ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {/* Decorative gradient blur */}
      <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-10 blur-2xl ${colorClass}`} />
    </div>
  )
}
