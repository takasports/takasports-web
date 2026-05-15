// Scraper MotoGP usando la API pública de Pulselive (la que consume motogp.com).
// Sin coste, sin IA. Cadena de 3 fetches: seasons → categories → standings.
// Devuelve `null` si algo falla — el cron orquestador marca ok:false sin escribir.
import type { StandingRow } from './stats-editorial'

const BASE = 'https://api.motogp.pulselive.com/motogp/v1/results'
const UA   = 'TakaSports/1.0 (+https://takasportsmedia.com)'

interface PulseSeason { id: string; year: number; current: boolean }
interface PulseCategory { id: string; name: string; legacy_id: number }
interface PulseClassRow {
  position: number
  points: number | null
  rider: { full_name: string; country: { iso: string }; number?: number | null }
  team:        { name: string } | null
  constructor: { name: string } | null
}
interface PulseStandings { classification: PulseClassRow[] }

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) return null
    return await res.json() as T
  } catch { return null }
}

function isoToFlag(iso: string): string | undefined {
  if (!iso || iso.length !== 2) return undefined
  // Mapear códigos legacy de Pulselive (3 letras) — algunos son ISO-3166-1 alpha-3.
  // Aquí asumimos alpha-2 (lo que devuelven hoy: IT, ES, JP, FR…).
  const cp = (s: string) => 0x1f1e6 + (s.toUpperCase().charCodeAt(0) - 65)
  return String.fromCodePoint(cp(iso[0])) + String.fromCodePoint(cp(iso[1]))
}

// Algunos países en Pulselive vienen en ISO-3 (SPA, ESP, ITA…). Mapping mínimo.
const ISO3_TO_2: Record<string, string> = {
  SPA: 'ES', ESP: 'ES', ITA: 'IT', FRA: 'FR', GER: 'DE', GBR: 'GB',
  USA: 'US', JPN: 'JP', AUS: 'AU', NED: 'NL', POR: 'PT', RSA: 'ZA',
  ARG: 'AR', BRA: 'BR', MEX: 'MX', SUI: 'CH', AUT: 'AT', BEL: 'BE',
}
function normalizeIso(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  if (iso.length === 2) return iso
  if (iso.length === 3) return ISO3_TO_2[iso.toUpperCase()] ?? undefined
  return undefined
}

export interface ScrapeResult {
  rows: StandingRow[]
  source: string
  asOf: string
}

export async function fetchMotogpRiders(): Promise<ScrapeResult | null> {
  const seasons = await getJson<PulseSeason[]>(`${BASE}/seasons`)
  if (!Array.isArray(seasons) || !seasons.length) return null
  const current = seasons.find(s => s.current) ?? seasons.find(s => s.year === new Date().getUTCFullYear())
  if (!current) return null

  const cats = await getJson<PulseCategory[]>(`${BASE}/categories?seasonUuid=${current.id}`)
  if (!Array.isArray(cats)) return null
  const motogp = cats.find(c => /motogp/i.test(c.name)) ?? cats.find(c => c.legacy_id === 3)
  if (!motogp) return null

  const std = await getJson<PulseStandings>(`${BASE}/standings?seasonUuid=${current.id}&categoryUuid=${motogp.id}`)
  if (!std || !Array.isArray(std.classification)) return null

  const rows: StandingRow[] = std.classification.slice(0, 25).map((c, i) => {
    const teamName  = c.team?.name ?? ''
    const construct = c.constructor?.name ?? ''
    const iso2 = normalizeIso(c.rider?.country?.iso)
    return {
      rank: c.position ?? i + 1,
      name: c.rider?.full_name ?? '—',
      abbr: teamName,
      value: String(c.points ?? 0),
      sub: `Temp. ${current.year}`,
      trend: 'flat' as const,
      flag: iso2 ? isoToFlag(iso2) : undefined,
      extra: construct ? { Marca: construct } as Record<string, string> : {} as Record<string, string>,
    }
  })

  return {
    rows,
    source: 'motogp.com (Pulselive API)',
    asOf: `Temp. ${current.year}`,
  }
}

export async function fetchMotogpConstructors(): Promise<ScrapeResult | null> {
  const seasons = await getJson<PulseSeason[]>(`${BASE}/seasons`)
  if (!Array.isArray(seasons) || !seasons.length) return null
  const current = seasons.find(s => s.current) ?? seasons.find(s => s.year === new Date().getUTCFullYear())
  if (!current) return null

  const cats = await getJson<PulseCategory[]>(`${BASE}/categories?seasonUuid=${current.id}`)
  if (!Array.isArray(cats)) return null
  const motogp = cats.find(c => /motogp/i.test(c.name)) ?? cats.find(c => c.legacy_id === 3)
  if (!motogp) return null

  // El standings de pilotos trae constructor por fila — agregamos por max points.
  const std = await getJson<PulseStandings>(`${BASE}/standings?seasonUuid=${current.id}&categoryUuid=${motogp.id}`)
  if (!std || !Array.isArray(std.classification)) return null

  const totals = new Map<string, number>()
  for (const c of std.classification) {
    const k = c.constructor?.name ?? ''
    if (!k) continue
    totals.set(k, Math.max(totals.get(k) ?? 0, c.points ?? 0))
  }
  const sorted = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const rows: StandingRow[] = sorted.map(([name, pts], i) => ({
    rank: i + 1,
    name,
    abbr: name.slice(0, 4).toUpperCase(),
    value: String(pts),
    sub: `Temp. ${current.year}`,
    trend: 'flat' as const,
    extra: {},
  }))

  return {
    rows,
    source: 'motogp.com (Pulselive API · derivado)',
    asOf: `Temp. ${current.year}`,
  }
}
