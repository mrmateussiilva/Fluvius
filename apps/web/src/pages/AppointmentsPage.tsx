import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { appointmentApi, clinicApi } from '../lib/api'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'

type Appointment = {
  id: string
  customerName: string
  customerPhone: string
  date: string
  status: string
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'muted' | 'default' {
  if (status === 'confirmed' || status === 'completed') return 'success'
  if (status === 'scheduled') return 'warning'
  if (status === 'canceled') return 'danger'
  if (status === 'pending') return 'muted'
  return 'default'
}

export function AppointmentsPage() {
  const [clinicId, setClinicId] = useState('')

  const clinicsQuery = useQuery({
    queryKey: ['clinics'],
    queryFn: () => clinicApi.list(),
  })

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', clinicId],
    queryFn: () => appointmentApi.list(clinicId || undefined),
  })

  return (
    <section className="space-y-4">
      <PageHeader title="Agendamentos" description="Listagem de agendamentos" />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-medium text-slate-800">Agenda</p>
          <select
            value={clinicId}
            onChange={(event) => setClinicId(event.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="">Todas as clínicas</option>
            {(clinicsQuery.data || []).map((clinic: { id: string; name: string }) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>
        </div>

        {appointmentsQuery.isLoading ? <p className="p-4 text-sm text-slate-500">Carregando agendamentos...</p> : null}
        {appointmentsQuery.isError ? <p className="p-4 text-sm text-red-600">Erro ao carregar agendamentos.</p> : null}

        {!appointmentsQuery.isLoading && !appointmentsQuery.isError ? (
          (appointmentsQuery.data || []).length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">customerName</th>
                    <th className="px-4 py-2 font-medium">customerPhone</th>
                    <th className="px-4 py-2 font-medium">date</th>
                    <th className="px-4 py-2 font-medium">status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(appointmentsQuery.data as Appointment[]).map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="px-4 py-3 text-slate-900">{appointment.customerName}</td>
                      <td className="px-4 py-3 text-slate-700">{appointment.customerPhone}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(appointment.date).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(appointment.status)}>{appointment.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState title="Nenhum agendamento encontrado" description="Quando houver agendamentos, eles aparecerão aqui." />
            </div>
          )
        ) : null}
      </Card>
    </section>
  )
}
