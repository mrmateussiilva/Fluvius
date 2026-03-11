import { useQuery } from '@tanstack/react-query'
import { appointmentApi, conversationApi, serviceApi } from '../lib/api'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'

const statItems = [
  { key: 'conversations', label: 'Total de conversas' },
  { key: 'services', label: 'Total de serviços' },
  { key: 'appointments', label: 'Total de agendamentos' },
] as const

export function DashboardPage() {
  const conversationsQuery = useQuery({
    queryKey: ['dashboard', 'conversations'],
    queryFn: () => conversationApi.list(),
  })

  const servicesQuery = useQuery({
    queryKey: ['dashboard', 'services'],
    queryFn: () => serviceApi.list(),
  })

  const appointmentsQuery = useQuery({
    queryKey: ['dashboard', 'appointments'],
    queryFn: () => appointmentApi.list(),
  })

  const hasError = conversationsQuery.isError || servicesQuery.isError || appointmentsQuery.isError

  if (hasError) {
    return (
      <EmptyState
        title="Não foi possível carregar a dashboard"
        description="Verifique a integração com a API e tente novamente."
      />
    )
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {statItems.map((item) => {
          const value =
            item.key === 'conversations'
              ? conversationsQuery.data?.length
              : item.key === 'services'
                ? servicesQuery.data?.length
                : appointmentsQuery.data?.length

          const loading =
            item.key === 'conversations'
              ? conversationsQuery.isLoading
              : item.key === 'services'
                ? servicesQuery.isLoading
                : appointmentsQuery.isLoading

          return (
            <Card key={item.key} className="p-4">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? '...' : value ?? 0}</p>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
