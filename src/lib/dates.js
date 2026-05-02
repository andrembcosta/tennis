import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { ptBR } from 'date-fns/locale'

export const CLUB_TZ = 'America/Sao_Paulo'

export function fmt(dateStr, formatStr) {
  const hasOffset = typeof dateStr === 'string' && (dateStr.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(dateStr))
  const date = hasOffset ? new Date(dateStr) : fromZonedTime(dateStr, CLUB_TZ)
  return formatInTimeZone(date, CLUB_TZ, formatStr, { locale: ptBR })
}
