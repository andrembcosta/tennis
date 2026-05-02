import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from 'react-query'
import api from './lib/api'
import LoginPage from './pages/LoginPage'
import CalendarPage from './pages/CalendarPage'
import MyBookingsPage from './pages/MyBookingsPage'
import AdminPage from './pages/AdminPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import RulesPage from './pages/RulesPage'
import Layout from './components/Layout'

function RequireAuth({ children, adminOnly = false }) {
  const { data: user, isLoading, isError } = useQuery(
    'me',
    () => api.get('/auth/me').then((r) => r.data),
    { retry: false }
  )
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading…</div>
  if (isError) return <Navigate to="/login" replace />
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<CalendarPage />} />
        <Route path="my-bookings" element={<MyBookingsPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route
          path="admin"
          element={
            <RequireAuth adminOnly>
              <AdminPage />
            </RequireAuth>
          }
        />
      </Route>
    </Routes>
  )
}
