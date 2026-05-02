import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../lib/api'
import { clearToken } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

const CATEGORY_LABELS = {
  iniciante: 'Iniciante',
  '5a_classe': '5ª Classe',
  '4a_classe': '4ª Classe',
  '3a_classe': '3ª Classe',
  '2a_classe': '2ª Classe',
  '1a_classe': '1ª Classe',
}

const DAYS = [
  { value: 'segunda',  label: 'Segunda-feira' },
  { value: 'terça',    label: 'Terça-feira' },
  { value: 'quarta',   label: 'Quarta-feira' },
  { value: 'quinta',   label: 'Quinta-feira' },
  { value: 'sexta',    label: 'Sexta-feira' },
  { value: 'sábado',   label: 'Sábado' },
  { value: 'domingo',  label: 'Domingo' },
]

const TIMES = Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`)

function calcAge(dob) {
  if (!dob) return null
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function formatDob(dob) {
  if (!dob) return '—'
  const [y, m, d] = dob.split('-')
  return `${d}/${m}/${y}`
}

export default function UserPanel() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [slots, setSlots] = useState(null)
  const ref = useRef(null)

  const { data: user } = useQuery('me', () => api.get('/auth/me').then((r) => r.data))

  useEffect(() => {
    if (user && slots === null) {
      setSlots((user.favorite_times || []).map((s) => {
        const [day, time] = s.split('|')
        return { day, time }
      }))
    }
  }, [user])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const update = useMutation(
    (body) => api.patch('/auth/me', body).then((r) => r.data),
    {
      onSuccess: (data) => {
        queryClient.setQueryData('me', data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      },
    }
  )

  const logout = () => { clearToken(); navigate('/login') }

  const addSlot = () => setSlots((s) => [...s, { day: 'segunda', time: '08:00' }])
  const removeSlot = (i) => setSlots((s) => s.filter((_, idx) => idx !== i))
  const updateSlot = (i, field, val) =>
    setSlots((s) => s.map((sl, idx) => idx === i ? { ...sl, [field]: val } : sl))

  const handleSave = () =>
    update.mutate({ favorite_times: slots.map((s) => `${s.day}|${s.time}`) })

  if (!user || slots === null) return null

  const age = calcAge(user.dob)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${open ? 'bg-red-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
      >
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${open ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'}`}>
          {user.name?.[0]?.toUpperCase()}
        </span>
        {user.name?.split(' ')[0]}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="bg-red-700 text-white px-4 py-3">
            <p className="font-semibold">{user.name}</p>
            <p className="text-red-200 text-xs">{user.email}</p>
          </div>

          <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-400">Nascimento</p>
                <p className="font-medium">{formatDob(user.dob)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Idade</p>
                <p className="font-medium">{age !== null ? `${age} anos` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Gênero</p>
                <p className="font-medium capitalize">{user.gender || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Categoria</p>
                <p className="font-medium">{CATEGORY_LABELS[user.tennis_category] || '—'}</p>
              </div>
            </div>

            <hr />

            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">
                Horários preferidos <span className="text-gray-400 font-normal">(até 3)</span>
              </p>
              <div className="space-y-2">
                {slots.map((sl, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <select
                      value={sl.day}
                      onChange={(e) => updateSlot(i, 'day', e.target.value)}
                      className="flex-1 border rounded-lg px-2 py-1.5 text-xs"
                    >
                      {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                    <select
                      value={sl.time}
                      onChange={(e) => updateSlot(i, 'time', e.target.value)}
                      className="w-20 border rounded-lg px-2 py-1.5 text-xs"
                    >
                      {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button onClick={() => removeSlot(i)} className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
                  </div>
                ))}
                {slots.length < 3 && (
                  <button
                    onClick={addSlot}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    + Adicionar horário
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={update.isLoading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {saved ? 'Salvo!' : 'Salvar horários'}
            </button>
          </div>

          <div className="border-t px-4 py-3">
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-800">
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
