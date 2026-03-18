import { ReactNode } from 'react'

type BoardColumnProps = {
  title: string
  count: number
  children: ReactNode
}

export function BoardColumn({ title, count, children }: BoardColumnProps) {
  return (
    <section className="flex h-full min-w-[310px] max-w-[340px] flex-col rounded-2xl border border-slate-200/60 bg-slate-50/50 backdrop-blur-sm shadow-sm overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-slate-600">{title}</h2>
          <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-slate-200/50 text-[10px] font-bold text-slate-500">
            {count}
          </span>
        </div>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar">
        {children}
      </div>
    </section>
  )
}
