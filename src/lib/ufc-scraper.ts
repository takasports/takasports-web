// Scraper UFC rankings vía ESPN core API (sports.core.api.espn.com).
// Devuelve top 10 P4P con nombre, país, división y trend.
// Sin coste, sin auth.
import type { StandingRow } from './stats-editorial'
import type { ScrapeResult } from './motogp-scraper'

const UA = 'TakaSports/1.0 (+https://takasportsmedia.com)'

interface EspnRank {
  current: number
  trend?: string
  athlete?: { $ref?: string }
  defenses?: number
  hasAccolade?: boolean
}
interface EspnRankingsResp { ranks?: EspnRank[]; name?: string; note?: string }
interface EspnAthlete {
  fullName?: string
  displayName?: string
  citizenship?: string
  citizenshipCountry?: { alt?: string; href?: string }
  weight?: { text?: string; shortName?: string }
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) return null
    return await res.json() as T
  } catch { return null }
}

function trendOf(t?: string): 'up' | 'down' | 'flat' {
  if (!t) return 'flat'
  if (t.startsWith('+') || t === 'up')   return 'up'
  if (t.startsWith('-') && t !== '-')    return 'down'
  if (t === 'down')                       return 'down'
  return 'flat'
}

// ESPN devuelve country como /countries/500/ngr.png — extraemos iso-3 → iso-2.
const ISO3_TO_2: Record<string, string> = {
  USA: 'US', BRA: 'BR', RUS: 'RU', NGA: 'NG', NGR: 'NG', GEO: 'GE', AUS: 'AU',
  CAN: 'CA', NZL: 'NZ', GBR: 'GB', IRL: 'IE', JPN: 'JP', KAZ: 'KZ', MEX: 'MX',
  ESP: 'ES', POL: 'PL', CHI: 'CL', CHN: 'CN', UKR: 'UA', SRB: 'RS', RSA: 'ZA',
  CMR: 'CM', NLD: 'NL', NED: 'NL', GER: 'DE', FRA: 'FR', ITA: 'IT', POR: 'PT',
  CHE: 'CH', SUI: 'CH', SWE: 'SE', NOR: 'NO', DEN: 'DK', BEL: 'BE', AUT: 'AT',
  COL: 'CO', ARG: 'AR', PER: 'PE', VEN: 'VE', URY: 'UY', PRY: 'PY',
  KOR: 'KR', PRK: 'KP', THA: 'TH', PHL: 'PH', VNM: 'VN', IDN: 'ID', IND: 'IN',
}
function isoToFlag(iso2: string): string | undefined {
  if (!iso2 || iso2.length !== 2) return undefined
  const cp = (s: string) => 0x1f1e6 + (s.toUpperCase().charCodeAt(0) - 65)
  return String.fromCodePoint(cp(iso2[0])) + String.fromCodePoint(cp(iso2[1]))
}
function citizenshipFlag(href?: string): string | undefined {
  if (!href) return undefined
  // .../countries/500/ngr.png
  const m = href.match(/\/countries\/[^/]+\/([a-z]{3})\.png$/i)
  if (!m) return undefined
  const iso2 = ISO3_TO_2[m[1].toUpperCase()]
  return iso2 ? isoToFlag(iso2) : undefined
}

export async function fetchUfcP4P(): Promise<ScrapeResult | null> {
  const ranking = await getJson<EspnRankingsResp>(
    'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/rankings/pound-for-pound'
  )
  if (!ranking || !Array.isArray(ranking.ranks) || !ranking.ranks.length) return null

  // Resolver datos de cada peleador en paralelo (top 10).
  const top = ranking.ranks.slice(0, 10)
  const athletes = await Promise.all(
    top.map(async r => r.athlete?.$ref ? await getJson<EspnAthlete>(r.athlete.$ref) : null)
  )

  const rows: StandingRow[] = top.map((r, i) => {
    const a = athletes[i]
    const name = a?.displayName ?? a?.fullName ?? `#${r.current}`
    const division = a?.weight?.text ?? a?.weight?.shortName ?? '—'
    const flag = citizenshipFlag(a?.citizenshipCountry?.href)
    return {
      rank: r.current,
      name,
      abbr: division.slice(0, 4).toUpperCase(),
      value: '—',
      sub: r.hasAccolade ? `Campeón · ${division}` : division,
      trend: trendOf(r.trend),
      flag,
      extra: {
        División: division,
        ...(typeof r.defenses === 'number' && r.defenses > 0 ? { Defensas: String(r.defenses) } : {}),
      },
    }
  })

  return {
    rows,
    source: 'ESPN UFC Rankings',
    asOf: `Semana ${new Date().toISOString().slice(0, 10)}`,
  }
}
