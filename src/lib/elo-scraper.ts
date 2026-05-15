// Scraper Elo World Football Ratings vía eloratings.net (TSV público).
// Sustituye al snapshot hardcoded FIFA porque:
// (1) FIFA bloquea scraping con Cloudflare + endpoint protegido
// (2) Elo se actualiza diariamente con cada partido jugado
// (3) Es la única ranking global de selecciones realmente automatizable.
import type { StandingRow } from './stats-editorial'
import type { ScrapeResult } from './motogp-scraper'

const URL_TSV = 'https://www.eloratings.net/World.tsv'
const UA = 'TakaSports/1.0 (+https://takasportsmedia.com)'

// Mapping ISO-2 → nombre en español + bandera. Top 60 selecciones cubre toda
// presencia en cualquier ranking realista. Si aparece un código no mapeado
// usamos el ISO-2 como fallback.
const ISO_TO_NAME_ES: Record<string, string> = {
  ES: 'España',          AR: 'Argentina',       FR: 'Francia',         EN: 'Inglaterra',
  BR: 'Brasil',          PT: 'Portugal',        CO: 'Colombia',        NL: 'Países Bajos',
  EC: 'Ecuador',         HR: 'Croacia',         IT: 'Italia',          DE: 'Alemania',
  BE: 'Bélgica',         UY: 'Uruguay',         MX: 'México',          MA: 'Marruecos',
  US: 'Estados Unidos',  CH: 'Suiza',           DK: 'Dinamarca',       JP: 'Japón',
  CL: 'Chile',           VE: 'Venezuela',       PE: 'Perú',            PY: 'Paraguay',
  RS: 'Serbia',          UA: 'Ucrania',         AT: 'Austria',         PL: 'Polonia',
  SE: 'Suecia',          NO: 'Noruega',         SK: 'Eslovaquia',      SI: 'Eslovenia',
  CZ: 'República Checa', HU: 'Hungría',         IE: 'Irlanda',         WS: 'Gales',
  WL: 'Gales',           NI: 'Irlanda del Norte',SC: 'Escocia',        TR: 'Turquía',
  GR: 'Grecia',          RO: 'Rumanía',         BG: 'Bulgaria',        BA: 'Bosnia',
  AL: 'Albania',         IL: 'Israel',          NG: 'Nigeria',         SN: 'Senegal',
  CI: 'Costa de Marfil', CM: 'Camerún',         GH: 'Ghana',           EG: 'Egipto',
  TN: 'Túnez',           DZ: 'Argelia',         KR: 'Corea del Sur',   IR: 'Irán',
  SA: 'Arabia Saudí',    QA: 'Catar',           AU: 'Australia',       CA: 'Canadá',
  CR: 'Costa Rica',      PA: 'Panamá',          JM: 'Jamaica',
}

function isoToFlag(iso2: string): string | undefined {
  if (iso2.length !== 2) return undefined
  const cp = (s: string) => 0x1f1e6 + (s.toUpperCase().charCodeAt(0) - 65)
  return String.fromCodePoint(cp(iso2[0])) + String.fromCodePoint(cp(iso2[1]))
}

export async function fetchEloWorldRanking(): Promise<ScrapeResult | null> {
  let tsv: string
  try {
    const res = await fetch(URL_TSV, {
      headers: { 'User-Agent': UA, Accept: 'text/tab-separated-values' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    tsv = await res.text()
  } catch { return null }

  // Cada línea: [change, rank, iso2, rating, ...muchas más columnas]
  const lines = tsv.trim().split('\n').slice(0, 25)
  if (lines.length < 5) return null

  const rows: StandingRow[] = lines.map((line, i) => {
    const cols = line.split('\t')
    const rank   = parseInt(cols[1] ?? String(i + 1)) || (i + 1)
    const iso2   = (cols[2] ?? '').toUpperCase()
    const rating = parseInt(cols[3] ?? '0') || 0
    const changeRaw = (cols[0] ?? '−').replace('−', '-')
    const trend: 'up' | 'down' | 'flat' =
      changeRaw === '0' || changeRaw === '−' || changeRaw === '-' ? 'flat'
      : changeRaw.startsWith('-') ? 'down' : 'up'
    const name = ISO_TO_NAME_ES[iso2] ?? iso2
    return {
      rank,
      name,
      abbr: iso2,
      value: String(rating),
      sub: 'Elo · actualizado diario',
      trend,
      flag: isoToFlag(iso2),
      extra: { Pts: String(rating) },
    }
  })

  return {
    rows,
    source: 'eloratings.net (Elo Ratings)',
    asOf: `Día ${new Date().toISOString().slice(0, 10)}`,
  }
}
