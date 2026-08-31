// ── Dónde verlo (lado servidor) ───────────────────────────────────────────────
// Traduce el nombre de competición que trae una noticia a una clave estable y lee
// broadcast_rights. Los datos puros de países viven en broadcast-countries.ts, que
// sí puede importar el cliente.

import { adminSupabase } from '@/lib/supabase-admin'
import { COUNTRY_NAMES, type BroadcastRow } from '@/lib/broadcast-countries'

export type { BroadcastRow }

// Competiciones cubiertas, por orden de tráfico real (Search Console, 90 días).
// LaLiga es la primera en los nueve países; la Premier es MÁS grande en Latam que
// en España (Perú 4,7 % frente a España 2,0 %), y por eso entra en la primera tanda.
export const COMPETITION_KEYS = ['laliga', 'premier', 'champions', 'ufc', 'selecciones'] as const
export type CompetitionKey = (typeof COMPETITION_KEYS)[number]

// El orden importa: Champions antes que LaLiga, para que "el Barcelona en Champions"
// resuelva a Champions y no a la liga doméstica.
const COMPETITION_PATTERNS: Array<{ key: CompetitionKey; rx: RegExp }> = [
  { key: 'champions',   rx: /\b(champions|liga de campeones|europa league|conference league)\b/ },
  { key: 'premier',     rx: /\bpremier\b/ },
  { key: 'laliga',      rx: /\b(la ?liga|primera division|liga ea sports|liga espanola)\b/ },
  { key: 'ufc',         rx: /\b(ufc|mma)\b/ },
  { key: 'selecciones', rx: /\b(mundial|world cup|eliminatorias|clasificatorias|nations league|copa america|eurocopa)\b/ },
]

const deburr = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Devuelve la clave de competición, o null si la noticia no es de ninguna cubierta.
// Acepta varios textos (competición del kickoff, titular, tags) y se queda con el
// primer patrón que encaje.
export function matchCompetition(...texts: Array<string | null | undefined>): CompetitionKey | null {
  const hay = deburr(texts.filter(Boolean).join(' '))
  if (!hay.trim()) return null
  for (const { key, rx } of COMPETITION_PATTERNS) {
    if (rx.test(hay)) return key
  }
  return null
}

// Lee las filas verificadas y vigentes de una competición. Server-only: usa la
// service key. Devuelve [] ante cualquier fallo — el bloque simplemente no se pinta,
// que es justo lo que queremos si el dato no es de fiar.
export async function getBroadcastRows(competition: CompetitionKey): Promise<BroadcastRow[]> {
  const sb = adminSupabase()
  if (!sb) return []
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('broadcast_rights')
    .select('country_code, channels, url, note, valid_from, valid_to')
    .eq('competition_key', competition)
    .eq('verified', true)
  if (error || !Array.isArray(data)) return []

  return data
    .filter((r) => (!r.valid_from || r.valid_from <= today) && (!r.valid_to || r.valid_to >= today))
    .map((r) => ({
      countryCode: r.country_code as string,
      country: COUNTRY_NAMES[r.country_code as string] ?? (r.country_code as string),
      channels: Array.isArray(r.channels) ? (r.channels as string[]) : [],
      url: r.url as string | null,
      note: r.note as string | null,
    }))
    .filter((r) => r.channels.length > 0)
    .sort((a, b) => a.country.localeCompare(b.country, 'es'))
}
