type SummaryStatCardProps = {
  title: string
  value: string | number
  hint?: string
}

export function SummaryStatCard({ title, value, hint }: SummaryStatCardProps) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-emerald-700">{hint}</p> : null}
    </div>
  )
}
