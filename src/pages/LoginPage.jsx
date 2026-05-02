import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from 'react-query'
import api from '../lib/api'
import { setToken } from '../lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showReset, setShowReset] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setToken(data.access_token)
      queryClient.invalidateQueries('me')
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setResetSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Logo" className="h-16 w-auto mb-3" />
          <h1 className="text-2xl font-bold text-center text-red-700">Barroca Tênis Clube</h1>
          <p className="text-center text-gray-500 text-sm mt-1">Entre com sua conta do clube</p>
        </div>

        {!showReset ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email" required placeholder="E-mail"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <input
              type="password" required placeholder="Senha"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
            <button
              type="button" onClick={() => setShowReset(true)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 text-center"
            >
              Esqueceu a senha?
            </button>
          </form>
        ) : resetSent ? (
          <p className="text-center text-sm text-gray-600">
            Se esse e-mail existir, um link de redefinição foi enviado. Verifique sua caixa de entrada.
          </p>
        ) : (
          <form onSubmit={handleForgot} className="space-y-4">
            <p className="text-sm text-gray-600">Informe seu e-mail e enviaremos um link para redefinir sua senha.</p>
            <input
              type="email" required placeholder="E-mail"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              type="submit" disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg text-sm"
            >
              Enviar link
            </button>
            <button type="button" onClick={() => setShowReset(false)} className="w-full text-xs text-gray-400">
              Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
