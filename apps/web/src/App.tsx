import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ServicesPage } from './pages/ServicesPage'
import { AppointmentsPage } from './pages/AppointmentsPage'

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-14">
            <div className="flex space-x-8">
              <Link to="/" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900">
                Conversas
              </Link>
              <Link to="/services" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                Serviços
              </Link>
              <Link to="/appointments" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                Agendamentos
              </Link>
            </div>
          </div>
        </div>
      </nav>
      {children}
    </>
  )
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />
        <Route path="/" element={<ProtectedLayout><DashboardPage /></ProtectedLayout>} />
        <Route path="/services" element={<ProtectedLayout><ServicesPage /></ProtectedLayout>} />
        <Route path="/appointments" element={<ProtectedLayout><AppointmentsPage /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
