import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clinicApi, serviceApi } from '../lib/api'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'

type Service = {
  id: string
  name: string
  price: number
  durationMinutes: number
  active: boolean
}

export function ServicesPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [clinicId, setClinicId] = useState('')
  const [formData, setFormData] = useState({
    clinicId: '',
    name: '',
    price: '',
    durationMinutes: '',
    active: true,
  })

  const clinicsQuery = useQuery({
    queryKey: ['clinics'],
    queryFn: () => clinicApi.list(),
  })

  const servicesQuery = useQuery({
    queryKey: ['services', clinicId],
    queryFn: () => serviceApi.list(clinicId || undefined),
  })

  const createMutation = useMutation({
    mutationFn: serviceApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      setSubmitMessage('Serviço criado com sucesso.')
      setFormData({ clinicId: '', name: '', price: '', durationMinutes: '', active: true })
      setShowForm(false)
    },
    onError: () => {
      setSubmitMessage('Erro ao criar serviço.')
    },
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitMessage(null)

    if (!formData.clinicId) {
      setSubmitMessage('Informe clinicId.')
      return
    }

    createMutation.mutate({
      clinicId: formData.clinicId,
      name: formData.name,
      price: Number(formData.price),
      durationMinutes: Number(formData.durationMinutes),
      active: formData.active,
    })
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Serviços"
        description="Cadastro e listagem de serviços"
        actions={
          <Button variant="primary" onClick={() => setShowForm((current) => !current)}>
            {showForm ? 'Fechar formulário' : 'Novo serviço'}
          </Button>
        }
      />

      {showForm ? (
        <Card className="p-4">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="service-clinic" className="block text-sm font-medium text-slate-700">
                  clinicId
                </label>
                <select
                  id="service-clinic"
                  value={formData.clinicId}
                  onChange={(event) => setFormData((current) => ({ ...current, clinicId: event.target.value }))}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  required
                >
                  <option value="">Selecione</option>
                  {(clinicsQuery.data || []).map((clinic: { id: string; name: string }) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="name"
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                required
              />
              <Input
                label="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(event) => setFormData((current) => ({ ...current, price: event.target.value }))}
                required
              />
              <Input
                label="durationMinutes"
                type="number"
                value={formData.durationMinutes}
                onChange={(event) => setFormData((current) => ({ ...current, durationMinutes: event.target.value }))}
                required
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(event) => setFormData((current) => ({ ...current, active: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              active
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Salvando...' : 'Salvar serviço'}
              </Button>
              {submitMessage ? <p className="text-sm text-slate-600">{submitMessage}</p> : null}
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-medium text-slate-800">Lista de serviços</p>
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

        {servicesQuery.isLoading ? <p className="p-4 text-sm text-slate-500">Carregando serviços...</p> : null}
        {servicesQuery.isError ? <p className="p-4 text-sm text-red-600">Erro ao carregar serviços.</p> : null}

        {!servicesQuery.isLoading && !servicesQuery.isError ? (
          (servicesQuery.data || []).length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Nome</th>
                    <th className="px-4 py-2 font-medium">Preço</th>
                    <th className="px-4 py-2 font-medium">Duração</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(servicesQuery.data as Service[]).map((service) => (
                    <tr key={service.id}>
                      <td className="px-4 py-3 text-slate-900">{service.name}</td>
                      <td className="px-4 py-3 text-slate-700">R$ {service.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-700">{service.durationMinutes} min</td>
                      <td className="px-4 py-3">
                        <Badge variant={service.active ? 'success' : 'muted'}>
                          {service.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState title="Nenhum serviço encontrado" description="Cadastre um novo serviço para começar." />
            </div>
          )
        ) : null}
      </Card>
    </section>
  )
}
