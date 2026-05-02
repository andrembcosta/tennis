import { Outlet, NavLink } from 'react-router-dom'
import { useQuery } from 'react-query'
import api from '../lib/api'
import UserPanel from './UserPanel'

export default function Layout() {
  const { data: user } = useQuery('me', () => api.get('/auth/me').then((r) => r.data))

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded text-sm font-medium ${isActive ? 'bg-red-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
            <span className="font-bold text-red-700 text-lg hidden sm:block">Barroca Tênis Clube</span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={linkClass}>Quadras</NavLink>
            <NavLink to="/my-bookings" className={linkClass}>Minhas Reservas</NavLink>
            <NavLink to="/rules" className={linkClass}>Regras</NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={linkClass}>Admin</NavLink>
            )}
            <div className="ml-2">
              <UserPanel />
            </div>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
