import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'

type TopbarConfig = {
  title: string
  description: string
}

const routeConfig: Record<string, TopbarConfig> = {
  '/': { title: 'Dashboard', description: 'Visão geral da operação' },
  '/conversations': {
    title: 'Painel de Atendimento',
    description: 'Visão geral da equipe comercial e do andamento dos atendimentos',
  },
  '/team-board': {
    title: 'Painel de Atendimento',
    description: 'Visão geral da equipe comercial e do andamento dos atendimentos',
  },
  '/services': { title: 'Serviços', description: 'Cadastro e manutenção de serviços' },
  '/appointments': { title: 'Agendamentos', description: 'Agenda de clientes' },
}

export function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()

  const config = routeConfig[location.pathname] || {
    title: 'Fluvius',
    description: 'Painel interno',
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{config.title}</h1>
          <p className="text-sm text-slate-500">{config.description}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleLogout}>
          Sair
        </Button>
      </div>
    </header>
  )
}
