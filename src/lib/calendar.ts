// Calendar and date utilities
import type { SportEvent } from '@/lib/types'
import { SOURCE_TZ } from '@/lib/timezone'

export function isoToLocalDate(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).formatToParts(new Date(isoDate))
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  return `${year}-${month}-${day}`
}

export function localDateToIso(localDate: string): Date {
  const [year, month, day] = localDate.split('-')
  return new Date(`${year}-${month}-${day}T12:00:00Z`)
}

export function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

export function namesMatch(a: string, b: string): boolean {
  const na = normalizeStr(a), nb = normalizeStr(b)
  return na.includes(nb) || nb.includes(na)
}

// Group events by local calendar date (YYYY-MM-DD)
export function groupEventsByDate(events: SportEvent[]): Record<string, SportEvent[]> {
  const grouped: Record<string, SportEvent[]> = {}
  for (const ev of events) {
    const key = ev.isoDate ? isoToLocalDate(ev.isoDate) : 'unknown'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(ev)
  }
  return grouped
}

// Get ordered date keys for grouped events
export function orderedDateKeys(grouped: Record<string, SportEvent[]>): string[] {
  return Object.keys(grouped).sort((a, b) => {
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    return a.localeCompare(b)
  })
}

// Format YYYY-MM-DD into a friendly label: "Hoy", "Mañana", or "Vie 5 May"
export function formatDateLabel(localDate: string): string {
  if (localDate === 'unknown') return 'Sin fecha'
  const today = isoToLocalDate(new Date().toISOString())
  if (localDate === today) return 'Hoy'

  const tomorrow = new Date(today + 'T12:00:00Z')
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowKey = tomorrow.toISOString().split('T')[0]
  if (localDate === tomorrowKey) return 'Mañana'

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const d = new Date(localDate + 'T12:00:00Z')
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`
}

// Agrupa los partidos de UN día por competición (en orden de primera aparición)
// y ordena CRONOLÓGICAMENTE por hora (isoDate = instante real) los partidos
// DENTRO de cada liga. Devuelve el orden de ligas — que quien llama puede
// reordenar luego, p.ej. fijando las favoritas — y el mapa liga→partidos.
//
// Por qué existe: en "Destacados" los partidos llegan ordenados por relevancia
// ("caché": equipo estrella, horario estelar, en directo), así que dentro de una
// misma liga un partidazo de las 22:00 podía salir antes que uno de las 18:00.
// Aquí se garantiza el orden por hora dentro de cada liga SIN tocar el orden en
// que aparecen las ligas. En el resto de vistas el orden de entrada ya es por
// hora, de modo que esta ordenación es idempotente.
export function groupDayByCompetition(dayEvents: SportEvent[]): {
  order: string[]
  byComp: Record<string, SportEvent[]>
} {
  const order: string[] = []
  const byComp: Record<string, SportEvent[]> = {}
  for (const ev of dayEvents) {
    if (!byComp[ev.comp]) {
      byComp[ev.comp] = []
      order.push(ev.comp)
    }
    byComp[ev.comp].push(ev)
  }
  for (const comp of order) {
    byComp[comp].sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? ''))
  }
  return { order, byComp }
}
