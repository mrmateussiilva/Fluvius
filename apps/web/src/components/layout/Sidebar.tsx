import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/team-board', label: 'Painel de atendimento' },
  { to: '/services', label: 'Serviços' },
  { to: '/appointments', label: 'Agendamentos' },
]

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 w-60 border-r border-slate-800 bg-slate-900 px-4 py-6">
      <div className="mb-8 px-2">
        <p className="text-lg font-semibold text-white">Fluvius</p>
        <p className="text-xs text-slate-400">Painel interno</p>
      </div>

      <nav className="space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm transition-colors ${
                isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
