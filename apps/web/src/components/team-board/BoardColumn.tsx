import { ReactNode } from 'react'

type BoardColumnProps = {
  title: string
  count: number
  children: ReactNode
}

export function BoardColumn({ title, count, children }: BoardColumnProps) {
  return (
    <section className="flex h-[calc(100vh-18rem)] min-w-[300px] max-w-[320px] flex-col rounded-xl border border-slate-200 bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{count}</span>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">{children}</div>
    </section>
  )
}
