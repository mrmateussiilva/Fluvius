import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../lib/api'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { MessageSquare, Scissors, Calendar, ArrowUpRight } from 'lucide-react'

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
  })

  if (isError) {
    return (
      <EmptyState
        title="Não foi possível carregar a dashboard"
        description="Verifique a integração com a API e tente novamente."
      />
    )
  }

  const stats = [
    {
      label: 'Total de conversas',
      value: data?.conversations ?? 0,
      icon: MessageSquare,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      trend: '+12%',
    },
    {
      label: 'Total de serviços',
      value: data?.services ?? 0,
      icon: Scissors,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      trend: '+5%',
    },
    {
      label: 'Total de agendamentos',
      value: data?.appointments ?? 0,
      icon: Calendar,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      trend: '+18%',
    },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Bom dia, Mateus</h1>
        <p className="text-slate-500">Aqui está o que está acontecendo na sua clínica hoje.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="group relative overflow-hidden p-6 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className={`rounded-xl ${stat.bg} p-3 transition-colors group-hover:bg-opacity-80`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <span>{stat.trend}</span>
                <ArrowUpRight className="h-3 w-3" />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-slate-900">
                  {isLoading ? (
                    <span className="inline-block h-8 w-16 animate-pulse rounded bg-slate-100" />
                  ) : (
                    stat.value
                  )}
                </h3>
              </div>
            </div>

            {/* Subtle decorative elements for "Premium" feel */}
            <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-slate-50 opacity-0 transition-opacity group-hover:opacity-100" />
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900">Atividade Recente</h3>
          <p className="mt-1 text-sm text-slate-500">As últimas conversas e agendamentos.</p>
          <div className="mt-6 flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-400 italic">Módulo de atividade em breve...</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-900">Próximos Agendamentos</h3>
          <p className="mt-1 text-sm text-slate-500">Agendamentos confirmados para hoje.</p>
          <div className="mt-6 flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-400 italic">Módulo de agenda em breve...</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
