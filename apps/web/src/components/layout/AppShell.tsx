import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-60 min-h-screen">
        <Topbar />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
