import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { fmt } from '../lib/dates'
import api from '../lib/api'

function UsersTab() {
  const queryClient = useQueryClient()
  const { data: users = [] } = useQuery('users-list', () => api.get('/users').then((r) => r.data))
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'player' })
  const [error, setError] = useState('')

  const createUser = useMutation(
    (body) => api.post('/users', body),
    {
      onSuccess: () => { queryClient.invalidateQueries('users-list'); setForm({ name: '', email: '', password: '', role: 'player' }) },
      onError: (e) => setError(e.response?.data?.detail || 'Erro ao criar sócio'),
    }
  )

  const toggleActive = useMutation(
    ({ id, is_active }) => api.patch(`/users/${id}`, { is_active }),
    { onSuccess: () => queryClient.invalidateQueries('users-list') }
  )

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Adicionar sócio</h3>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm col-span-2" />
          <input placeholder="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="player">Sócio</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={() => createUser.mutate(form)}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded-lg">
            Adicionar
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">E-mail</th>
              <th className="px-4 py-3 text-left">Perfil</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">{u.role === 'admin' ? 'Admin' : 'Sócio'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                    className="text-xs text-gray-500 hover:text-gray-800 underline">
                    {u.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CourtsTab() {
  const queryClient = useQueryClient()
  const { data: courts = [] } = useQuery('courts', () => api.get('/courts').then((r) => r.data))

  const toggleCourt = useMutation(
    ({ id, is_active }) => api.patch(`/courts/${id}`, { is_active }),
    { onSuccess: () => queryClient.invalidateQueries('courts') }
  )

  return (
    <div className="grid grid-cols-3 gap-3">
      {courts.map((c) => (
        <div key={c.id} className="bg-white border rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="font-medium">{c.name}</span>
            {c.is_singles_only && <span className="ml-2 text-xs text-gray-400">simples</span>}
          </div>
          <button onClick={() => toggleCourt.mutate({ id: c.id, is_active: !c.is_active })}
            className={`text-xs px-3 py-1 rounded-full border ${c.is_active ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}>
            {c.is_active ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      ))}
    </div>
  )
}

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const RECURRENCE_LABELS = { none: 'Sem recorrência', daily: 'Diária', weekly: 'Semanal' }

function describeRecurrence(blk) {
  if (blk.recurrence === 'none') {
    return blk.specific_date ? `Única vez · ${fmt(blk.specific_date + 'T12:00:00', 'dd/MM/yyyy')}` : 'Única vez'
  }
  if (blk.recurrence === 'daily') return 'Todos os dias'
  if (blk.recurrence === 'weekly') {
    const days = (blk.weekdays || []).map((d) => DAY_NAMES[d]).join(', ')
    return `Semanal: ${days}`
  }
  return ''
}

function AgendaTab() {
  const queryClient = useQueryClient()
  const { data: courts = [] } = useQuery('courts', () => api.get('/courts').then((r) => r.data))
  const { data: blocks = [] } = useQuery('schedule-blocks', () => api.get('/admin/schedule').then((r) => r.data))

  const emptyForm = {
    title: '', court_id: '', time_start: '08:00', time_end: '09:00',
    recurrence: 'none', weekdays: [], specific_date: '', is_release: false,
  }
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const addBlock = useMutation(
    (body) => api.post('/admin/schedule', body),
    {
      onSuccess: () => { queryClient.invalidateQueries('schedule-blocks'); setForm(emptyForm); setError('') },
      onError: (e) => setError(e.response?.data?.detail || 'Erro ao salvar'),
    }
  )

  const deleteBlock = useMutation(
    (id) => api.delete(`/admin/schedule/${id}`),
    { onSuccess: () => queryClient.invalidateQueries('schedule-blocks') }
  )

  const toggleWeekday = (d) => {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d],
    }))
  }

  const handleSubmit = () => {
    addBlock.mutate({
      title: form.title,
      court_id: form.court_id === '' ? null : parseInt(form.court_id),
      time_start: form.time_start,
      time_end: form.time_end,
      recurrence: form.recurrence,
      weekdays: form.recurrence === 'weekly' ? form.weekdays : [],
      specific_date: form.recurrence === 'none' && form.specific_date ? form.specific_date : null,
      is_release: form.is_release,
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Adicionar bloqueio ou liberação</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="Título (ex: Aula de Tênis, Clube Fechado)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm col-span-2"
          />

          <select
            value={form.court_id}
            onChange={(e) => setForm({ ...form, court_id: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todas as quadras</option>
            {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={form.recurrence}
            onChange={(e) => setForm({ ...form, recurrence: e.target.value, weekdays: [], specific_date: '' })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="none">Sem recorrência (data única)</option>
            <option value="daily">Diária (todos os dias)</option>
            <option value="weekly">Semanal (dias específicos)</option>
          </select>

          <div className="flex gap-2 items-center">
            <label className="text-xs text-gray-500 shrink-0">Início</label>
            <input type="time" value={form.time_start} onChange={(e) => setForm({ ...form, time_start: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm flex-1" />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-xs text-gray-500 shrink-0">Fim</label>
            <input type="time" value={form.time_end} onChange={(e) => setForm({ ...form, time_end: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm flex-1" />
          </div>

          {form.recurrence === 'weekly' && (
            <div className="col-span-2 flex gap-2 flex-wrap">
              {DAY_NAMES.map((name, d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    form.weekdays.includes(d)
                      ? 'bg-red-600 text-white border-red-600'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {form.recurrence === 'none' && (
            <div className="col-span-2 flex gap-2 items-center">
              <label className="text-xs text-gray-500 shrink-0">Data</label>
              <input type="date" value={form.specific_date} onChange={(e) => setForm({ ...form, specific_date: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm" />
            </div>
          )}

          <div className="col-span-2 flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, is_release: false })}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                !form.is_release ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Bloqueio
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_release: true })}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                form.is_release ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Liberação
            </button>
          </div>

          {error && <p className="col-span-2 text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!form.title || addBlock.isLoading}
            className="col-span-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg"
          >
            Adicionar
          </button>
        </div>
      </div>

      {blocks.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Título</th>
                <th className="px-4 py-3 text-left">Quadra(s)</th>
                <th className="px-4 py-3 text-left">Horário</th>
                <th className="px-4 py-3 text-left">Recorrência</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {blocks.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      b.is_release ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {b.is_release ? 'Liberação' : 'Bloqueio'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{b.title}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {b.court_id ? courts.find((c) => c.id === b.court_id)?.name : 'Todas'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {b.time_start.slice(0, 5)} – {b.time_end === '00:00:00' || b.time_end === '00:00' ? '00:00' : b.time_end.slice(0, 5)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{describeRecurrence(b)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteBlock.mutate(b.id)} className="text-xs text-red-500 hover:text-red-700">
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatsTab() {
  const { data: stats } = useQuery('stats', () => api.get('/admin/stats').then((r) => r.data))
  if (!stats) return <div className="text-gray-400 py-8 text-center">Carregando…</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{Math.round(stats.utilization_rate * 100)}%</p>
          <p className="text-sm text-gray-500 mt-1">Ocupação das quadras (30d)</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{Math.round(stats.open_request_ratio * 100)}%</p>
          <p className="text-sm text-gray-500 mt-1">Solicitações abertas</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-700">{stats.player_stats.length}</p>
          <p className="text-sm text-gray-500 mt-1">Sócios ativos</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <h3 className="font-semibold px-4 py-3 border-b">Atividade dos sócios</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Sócio</th>
              <th className="px-4 py-3 text-right">Esta semana</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Cancelamentos</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {stats.player_stats.map((ps) => (
              <tr key={ps.player.id}>
                <td className="px-4 py-3">{ps.player.name}</td>
                <td className="px-4 py-3 text-right">{ps.bookings_this_week}</td>
                <td className="px-4 py-3 text-right">{ps.total_bookings}</td>
                <td className="px-4 py-3 text-right">{Math.round(ps.cancellation_rate * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.keys(stats.peak_hours).length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold mb-3">Horários de pico (últimos 30 dias)</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.peak_hours)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 20)
              .map(([label, count]) => (
                <span key={label} className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                  {label} ({count})
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BookingsTab() {
  const queryClient = useQueryClient()
  const { data: bookings = [] } = useQuery('admin-bookings', () => api.get('/admin/bookings').then((r) => r.data))

  const cancelBooking = useMutation(
    (id) => api.delete(`/admin/bookings/${id}`),
    { onSuccess: () => queryClient.invalidateQueries('admin-bookings') }
  )

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Horário</th>
            <th className="px-4 py-3 text-left">Quadra</th>
            <th className="px-4 py-3 text-left">Sócios</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {bookings.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-3">{fmt(b.slot_start, 'dd MMM HH:mm')}</td>
              <td className="px-4 py-3">{b.court.name}</td>
              <td className="px-4 py-3">{b.booker.name} & {b.partner.name}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  b.status === 'confirmed' ? 'bg-blue-100 text-blue-700'
                  : b.status === 'cancelled' ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-gray-600'
                }`}>
                  {b.status === 'confirmed' ? 'Confirmada' : b.status === 'cancelled' ? 'Cancelada' : 'Concluída'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {b.status === 'confirmed' && (
                  <button onClick={() => cancelBooking.mutate(b.id)}
                    className="text-xs text-red-500 hover:text-red-700">Cancelar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState('users')
  const tabs = [
    { id: 'users',    label: 'Sócios' },
    { id: 'courts',   label: 'Quadras' },
    { id: 'agenda',   label: 'Agenda' },
    { id: 'bookings', label: 'Reservas' },
    { id: 'stats',    label: 'Estatísticas' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Painel Admin</h1>
      <div className="flex gap-1 mb-6 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'users'    && <UsersTab />}
      {tab === 'courts'   && <CourtsTab />}
      {tab === 'agenda'   && <AgendaTab />}
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'stats'    && <StatsTab />}
    </div>
  )
}
