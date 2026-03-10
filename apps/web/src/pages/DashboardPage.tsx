import { Link } from 'react-router-dom'

export function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Fluvius</h1>
            </div>
            <div className="flex items-center">
              <Link
                to="/login"
                className="text-gray-600 hover:text-gray-900"
              >
                Logout
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <h2 className="text-3xl font-bold text-gray-500">Fluvius</h2>
          </div>
        </div>
      </main>
    </div>
  )
}
