import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { fmt } from '../lib/dates'
import api from '../lib/api'

function PlayerSearch({ currentUserId, selected, onChange }) {
  const [search, setSearch] = useState('')
  const { data: players = [] } = useQuery('players', () =>
    api.get('/users/players').then((r) => r.data)
  )

  const filtered = players
    .filter((p) => p.id !== currentUserId)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Buscar sócio…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        autoFocus
      />
      <div className="max-h-48 overflow-y-auto space-y-0.5 border rounded-lg divide-y">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">Nenhum sócio encontrado</p>
        )}
        {filtered.map((p) => (
          <label key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))
              }
              className="accent-blue-600"
            />
            <span className="text-sm">{p.name}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-blue-600">{selected.length} sócio{selected.length > 1 ? 's' : ''} selecionado{selected.length > 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

function SlotModal({ slot, initialMode, onClose }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState(initialMode || null)
  const [joinRequestId, setJoinRequestId] = useState(null)
  const [joinCourtId, setJoinCourtId] = useState(null)
  const [inviteIds, setInviteIds] = useState([])
  const [error, setError] = useState('')

  const { data: me } = useQuery('me', () => api.get('/auth/me').then((r) => r.data))

  const createRequest = useMutation(
    (body) => api.post('/bookings/requests', body),
    {
      onSuccess: () => { queryClient.invalidateQueries('calendar'); onClose() },
      onError: (e) => setError(e.response?.data?.detail || 'Erro ao criar solicitação'),
    }
  )

  const confirmBooking = useMutation(
    (body) => api.post('/bookings/confirm', body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('calendar')
        queryClient.invalidateQueries('my-bookings')
        onClose()
      },
      onError: (e) => setError(e.response?.data?.detail || 'Erro ao confirmar reserva'),
    }
  )

  const isFull = slot.available_courts.length === 0
  const myOpenRequest = slot.open_requests.find((r) => r.booker.id === me?.id)
  const joinableRequests = [...slot.open_requests.filter(r => r.booker.id !== me?.id), ...slot.invited_requests]

  const handleSubmitRequest = () => {
    createRequest.mutate({
      slot_start: slot.slot_start,
      type: mode,
      invited_player_ids: mode === 'named' ? inviteIds : [],
    })
  }

  const handleJoin = () => {
    confirmBooking.mutate({ request_id: joinRequestId, court_id: joinCourtId })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="font-bold text-lg">{fmt(slot.slot_start, 'EEE d MMM')}</h2>
            <p className="text-gray-500 text-sm">
              {fmt(slot.slot_start, 'HH:mm')} – {fmt(slot.slot_end, 'HH:mm')}
              {' · '}{slot.available_courts.length}/{slot.total_courts} quadras disponíveis
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {isFull ? (
          <p className="text-gray-500 text-sm text-center py-4">Todas as quadras estão ocupadas neste horário.</p>
        ) : mode === 'joinable' ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Jogos disponíveis para entrar:</p>
            {joinableRequests.map((req) => {
              const isInvite = slot.invited_requests.some(r => r.id === req.id)
              return (
                <div key={req.id}
                  onClick={() => setJoinRequestId(joinRequestId === req.id ? null : req.id)}
                  className={`border-2 rounded-lg p-3 cursor-pointer transition-colors ${joinRequestId === req.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{req.booker.name}</span>
                    {isInvite && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Convite</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isInvite ? 'Você foi convidado para este jogo' : 'Jogo em aberto para qualquer sócio'}
                  </p>
                </div>
              )
            })}
            {joinRequestId && (
              <>
                <p className="text-sm font-medium text-gray-700 mt-2">Escolha uma quadra:</p>
                <div className="grid grid-cols-3 gap-2">
                  {slot.available_courts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setJoinCourtId(c.id)}
                      className={`border-2 rounded-lg p-3 text-sm font-medium transition-colors ${joinCourtId === c.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-400'}`}
                    >
                      {c.name}
                      {c.is_singles_only && (
                        <span className="block text-xs font-normal text-gray-400 mt-0.5">simples</span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  disabled={!joinCourtId || confirmBooking.isLoading}
                  onClick={handleJoin}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
                >
                  Confirmar reserva
                </button>
              </>
            )}
            <button onClick={() => setMode(null)} className="w-full text-xs text-gray-400 hover:text-gray-600">Voltar</button>
          </div>
        ) : !mode ? (
          <div className="space-y-3">
            {joinableRequests.length > 0 && (
              <button
                onClick={() => setMode('joinable')}
                className="w-full border-2 border-blue-200 hover:border-blue-400 rounded-lg p-3 text-sm text-left"
              >
                <span className="font-medium text-blue-700">
                  {joinableRequests.length} jogo{joinableRequests.length > 1 ? 's' : ''} em aberto
                </span>
                <span className="block text-gray-500 text-xs mt-0.5">
                  {slot.invited_requests.length > 0 ? 'Inclui convite(s) para você' : 'Clique para ver e entrar'}
                </span>
              </button>
            )}
            {myOpenRequest ? (
              <p className="text-sm text-gray-500 text-center py-1">Você já tem uma solicitação aberta neste horário.</p>
            ) : (
              <>
                {joinableRequests.length > 0 && <div className="text-xs text-gray-400 text-center">ou crie uma nova solicitação</div>}
                <button
                  onClick={() => setMode('open')}
                  className="w-full border-2 border-green-200 hover:border-green-400 rounded-lg p-3 text-sm text-left"
                >
                  <span className="font-medium text-green-700">Solicitação aberta</span>
                  <span className="block text-gray-500 text-xs mt-0.5">Qualquer sócio pode entrar</span>
                </button>
                <button
                  onClick={() => setMode('named')}
                  className="w-full border-2 border-blue-200 hover:border-blue-400 rounded-lg p-3 text-sm text-left"
                >
                  <span className="font-medium text-blue-700">Solicitação nominada</span>
                  <span className="block text-gray-500 text-xs mt-0.5">Convidar sócios específicos</span>
                </button>
              </>
            )}
          </div>
        ) : mode === 'open' ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Sua solicitação ficará visível para todos os sócios. O parceiro escolhe a quadra ao aceitar.</p>
            <button
              disabled={createRequest.isLoading}
              onClick={handleSubmitRequest}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
            >
              Publicar solicitação aberta
            </button>
            <button onClick={() => setMode(null)} className="w-full text-xs text-gray-400">Voltar</button>
          </div>
        ) : mode === 'named' ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Selecione os sócios para convidar:</p>
            <PlayerSearch
              currentUserId={me?.id}
              selected={inviteIds}
              onChange={setInviteIds}
            />
            <button
              disabled={inviteIds.length === 0 || createRequest.isLoading}
              onClick={handleSubmitRequest}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
            >
              Enviar convites
            </button>
            <button onClick={() => setMode(null)} className="w-full text-xs text-gray-400">Voltar</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [initialMode, setInitialMode] = useState(null)

  const { data: me } = useQuery('me', () => api.get('/auth/me').then((r) => r.data))
  const { data: calendar = [], isLoading } = useQuery(
    'calendar',
    () => api.get('/bookings/calendar').then((r) => r.data),
    { refetchInterval: 60_000 }
  )

  const openModal = (slot, mode = null) => {
    setSelectedSlot(slot)
    setInitialMode(mode)
  }

  const grouped = calendar.reduce((acc, slot) => {
    const day = fmt(slot.slot_start, 'yyyy-MM-dd')
    if (!acc[day]) acc[day] = []
    acc[day].push(slot)
    return acc
  }, {})

  if (isLoading) return <div className="text-center py-12 text-gray-500">Carregando agenda…</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reservar quadra</h1>

      <div className="flex items-center gap-4 mb-5 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 border border-green-400 inline-block"></span>Disponível</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 inline-block"></span>Seu jogo</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-400 inline-block"></span>Sua solicitação</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-200 border border-blue-400 inline-block"></span>Jogos em aberto</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block"></span>Completo</span>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([day, slots]) => (
          <div key={day}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {fmt(day + 'T12:00:00', 'EEEE, d MMMM')}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {slots.map((slot) => {
                const myBooking = slot.my_booking
                const isFull = !myBooking && slot.available_courts.length === 0
                const myOpenRequest = slot.open_requests.find((r) => r.booker.id === me?.id)
                const hasMyNamedRequest = (slot.my_named_requests?.length ?? 0) > 0
                const hasMyRequest = !myBooking && (Boolean(myOpenRequest) || hasMyNamedRequest)
                const joinableRequests = [...slot.open_requests.filter(r => r.booker.id !== me?.id), ...slot.invited_requests]
                const hasInvite = slot.invited_requests.length > 0
                const totalOpenCount = slot.open_requests.length
                const showBlue = !myBooking && !hasMyRequest && (totalOpenCount > 0 || hasInvite)

                const partner = myBooking
                  ? (myBooking.booker.id === me?.id ? myBooking.partner : myBooking.booker)
                  : null

                const badgeLabel = hasMyRequest
                  ? 'Solicitação pendente'
                  : hasInvite
                    ? '✉ Convite'
                    : `${totalOpenCount} jogo${totalOpenCount > 1 ? 's' : ''} em aberto`
                const badgeMode = hasMyRequest ? null : joinableRequests.length > 0 ? 'joinable' : null
                const showBadge = !isFull && !myBooking && (hasMyRequest || showBlue)

                if (myBooking) {
                  return (
                    <div key={slot.slot_start} className="rounded-lg border-2 text-sm overflow-hidden bg-green-500 border-green-500 text-white">
                      <div className="p-2 text-center">
                        <div className="font-semibold text-base">{fmt(slot.slot_start, 'HH:mm')}</div>
                        <div className="text-xs mt-0.5 text-green-100">{myBooking.court.name}</div>
                      </div>
                      <div className="w-full text-xs py-1 px-2 font-medium border-t border-green-400 bg-green-600 text-center">
                        Seu jogo · {partner?.name?.split(' ')[0]}
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={slot.slot_start}
                    className={`rounded-lg border-2 text-sm overflow-hidden ${
                      isFull
                        ? 'bg-red-50 border-red-200 text-red-400'
                        : hasMyRequest
                          ? 'bg-white border-yellow-400 text-gray-800'
                          : showBlue
                            ? 'bg-white border-blue-300 text-gray-800'
                            : 'bg-white border-green-300 text-gray-800'
                    }`}
                  >
                    <button
                      disabled={isFull}
                      onClick={() => !isFull && openModal(slot)}
                      className="w-full p-2 text-center disabled:cursor-default"
                    >
                      <div className="font-semibold text-base">{fmt(slot.slot_start, 'HH:mm')}</div>
                      <div className={`text-xs mt-0.5 ${isFull ? 'text-red-400' : 'text-gray-500'}`}>
                        {isFull
                          ? 'Completo'
                          : `${slot.available_courts.length}/${slot.total_courts} quadras`
                        }
                      </div>
                    </button>

                    {showBadge && (
                      <button
                        onClick={() => openModal(slot, badgeMode)}
                        className={`w-full text-xs py-1 px-2 font-medium border-t transition-colors ${
                          hasMyRequest
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                            : hasInvite
                              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        {badgeLabel}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {calendar.length === 0 && (
          <p className="text-gray-400 text-center py-12">Nenhum horário disponível.</p>
        )}
      </div>

      {selectedSlot && (
        <SlotModal
          slot={selectedSlot}
          initialMode={initialMode}
          onClose={() => { setSelectedSlot(null); setInitialMode(null) }}
        />
      )}
    </div>
  )
}
