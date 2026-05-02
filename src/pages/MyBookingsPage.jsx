import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { fmt, CLUB_TZ } from '../lib/dates'
import { formatInTimeZone } from 'date-fns-tz'
import api from '../lib/api'

function isLateCancel(slotStart) {
  const today = formatInTimeZone(new Date(), CLUB_TZ, 'yyyy-MM-dd')
  return fmt(slotStart, 'yyyy-MM-dd') <= today
}

export default function MyBookingsPage() {
  const queryClient = useQueryClient()
  const [cancelError, setCancelError] = useState('')

  const { data: me } = useQuery('me', () => api.get('/auth/me').then((r) => r.data))
  const { data: bookings = [] } = useQuery('my-bookings', () =>
    api.get('/bookings/mine').then((r) => r.data)
  )
  const { data: cancelledBookings = [] } = useQuery('my-cancelled-bookings', () =>
    api.get('/bookings/mine/cancelled').then((r) => r.data)
  )
  const { data: requests = [] } = useQuery('my-requests', () =>
    api.get('/bookings/requests/mine').then((r) => r.data)
  )

  const cancelBooking = useMutation(
    (id) => api.delete(`/bookings/${id}`),
    {
      onSuccess: () => { setCancelError(''); queryClient.invalidateQueries('my-bookings'); queryClient.invalidateQueries('my-cancelled-bookings') },
      onError: (e) => setCancelError(e.response?.data?.detail || 'Erro ao cancelar'),
    }
  )

  const cancelRequest = useMutation(
    (id) => api.delete(`/bookings/requests/${id}`),
    {
      onSuccess: () => { setCancelError(''); queryClient.invalidateQueries('my-requests') },
      onError: (e) => setCancelError(e.response?.data?.detail || 'Erro ao cancelar'),
    }
  )

  return (
    <div className="space-y-8">
      {cancelError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex justify-between items-start">
          <span>{cancelError}</span>
          <button onClick={() => setCancelError('')} className="ml-4 text-red-400 hover:text-red-600 leading-none">×</button>
        </div>
      )}
      <section>
        <h1 className="text-2xl font-bold mb-4">Reservas confirmadas</h1>
        {bookings.length === 0 ? (
          <p className="text-gray-400">Nenhuma reserva futura.</p>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="bg-white border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {fmt(b.slot_start, 'EEE d MMM, HH:mm')} – {fmt(b.slot_end, 'HH:mm')}
                  </p>
                  <p className="text-sm text-gray-500">{b.court.name} · com {b.booker.id === me?.id ? b.partner.name : b.booker.name}</p>
                </div>
                <button
                  onClick={() => {
                    const late = isLateCancel(b.slot_start)
                    const msg = late
                      ? 'Atenção: cancelar hoje não libera o bloqueio de reservas. Você e seu parceiro ficarão bloqueados para novas reservas até o fim deste horário.\n\nConfirmar cancelamento?'
                      : 'Cancelar esta reserva?'
                    if (confirm(msg)) cancelBooking.mutate(b.id)
                  }}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1 rounded-full"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {cancelledBookings.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-1">Reservas canceladas</h2>
          <p className="text-sm text-gray-500 mb-4">Cancelamentos no mesmo dia bloqueiam novas reservas até o fim do horário.</p>
          <div className="space-y-3">
            {cancelledBookings.map((b) => (
              <div key={b.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="font-medium text-red-700">
                  {fmt(b.slot_start, 'EEE d MMM, HH:mm')} – {fmt(b.slot_end, 'HH:mm')}
                </p>
                <p className="text-sm text-red-500">{b.court.name} · com {b.booker.id === me?.id ? b.partner.name : b.booker.name}</p>
                <p className="text-xs text-red-400 mt-1">Bloqueio encerra às {fmt(b.slot_end, 'HH:mm')}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold mb-4">Solicitações pendentes</h2>
        {requests.length === 0 ? (
          <p className="text-gray-400">Nenhuma solicitação pendente.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="bg-white border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {fmt(r.slot_start, 'EEE d MMM, HH:mm')}
                  </p>
                  <p className="text-sm text-gray-500">
                    {r.type === 'open' ? 'Aberta para todos os sócios' : `Convidados: ${r.invites.map((i) => i.invited_player.name).join(', ')}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Cancelar esta solicitação?')) cancelRequest.mutate(r.id)
                  }}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1 rounded-full"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
