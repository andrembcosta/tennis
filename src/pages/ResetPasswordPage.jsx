import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/auth/reset-password', { token: params.get('token'), new_password: password })
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao redefinir senha')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-8">
        <h1 className="text-xl font-bold text-center mb-6">Redefinir senha</h1>
        {done ? (
          <p className="text-center text-red-600">Senha atualizada! Redirecionando…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password" required minLength={8} placeholder="Nova senha"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg text-sm"
            >
              Atualizar senha
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
