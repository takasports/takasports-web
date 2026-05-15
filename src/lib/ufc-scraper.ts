// Scraper UFC rankings vía ufc.com/rankings (HTML scrape, sin auth, sin coste).
// ESPN tiene los rankings de UFC desactualizados desde que UFC y ESPN no son
// socios; ufc.com es la fuente oficial canónica.
import type { StandingRow } from './stats-editorial'
import type { ScrapeResult } from './motogp-scraper'

const URL_RANKINGS = 'https://www.ufc.com/rankings'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

interface DivisionBlock {
  name: string                    // "Men's Pound-for-Pound", "Lightweight", etc.
  champion: string | null         // current champ
  contenders: { rank: number; name: string }[]
}

const DECODE: Array<[RegExp, string]> = [
  [/&#039;/g, "'"], [/&amp;/g, '&'], [/&quot;/g, '"'],
  [/&lt;/g, '<'],   [/&gt;/g, '>'], [/&nbsp;/g, ' '],
]
function decodeEntities(s: string): string {
  let out = s
  for (const [re, ch] of DECODE) out = out.replace(re, ch)
  return out
}

function parseUfcRankings(html: string): DivisionBlock[] {
  // Cada división empieza con `<div class="view-grouping-header">{NAME}</div>`
  const segments = html.split('<div class="view-grouping-header">').slice(1)
  const out: DivisionBlock[] = []
  for (const seg of segments) {
    const nameMatch = seg.match(/^\s*([^<]+)</)
    if (!nameMatch) continue
    const name = decodeEntities(nameMatch[1].trim())

    const champMatch = seg.match(/<h5[^>]*>\s*<a [^>]*>([^<]+)<\/a>/)
    const champion = champMatch ? decodeEntities(champMatch[1].trim()) : null

    const rowRe = /<td class="views-field views-field-weight-class-rank">\s*(\d+)\s*<\/td>\s*<td class="views-field views-field-title">\s*<a [^>]*>([^<]+)<\/a>/g
    const seenRanks = new Set<number>()
    const contenders: { rank: number; name: string }[] = []
    let m: RegExpExecArray | null
    while ((m = rowRe.exec(seg)) !== null) {
      const rank = parseInt(m[1])
      const fname = decodeEntities(m[2].trim())
      // Skip duplicate rank (UFC HTML a veces repite rows con #2 cuando hay tied)
      if (seenRanks.has(rank) && contenders.length >= 10) continue
      seenRanks.add(rank)
      contenders.push({ rank, name: fname })
      if (contenders.length >= 15) break
    }

    out.push({ name, champion, contenders })
  }
  return out
}

// Construye name → división de campeonato (para P4P enriquecimiento)
function buildChampionDivisionMap(blocks: DivisionBlock[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const b of blocks) {
    // Skip P4P (no es una división física)
    if (/pound-for-pound|p4p/i.test(b.name)) continue
    if (b.champion) m.set(b.champion, b.name)
  }
  return m
}

export async function fetchUfcP4P(): Promise<ScrapeResult | null> {
  let html: string
  try {
    const res = await fetch(URL_RANKINGS, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    html = await res.text()
  } catch { return null }

  const blocks = parseUfcRankings(html)
  if (!blocks.length) return null

  const p4pBlock = blocks.find(b => /men.{0,3}pound-for-pound/i.test(b.name))
  if (!p4pBlock || !p4pBlock.contenders.length) return null

  const champDivision = buildChampionDivisionMap(blocks)

  const rows: StandingRow[] = p4pBlock.contenders.slice(0, 10).map((c, i) => {
    const division = champDivision.get(c.name)
    return {
      rank: c.rank ?? i + 1,
      name: c.name,
      abbr: division ? division.slice(0, 4).toUpperCase() : 'P4P',
      value: '—',
      sub: division ? `Campeón · ${division}` : 'Pound-for-Pound',
      trend: 'flat' as const,
      extra: (division
        ? { División: division, Estado: 'Campeón' }
        : { División: 'Cross-weight' }) as Record<string, string>,
    }
  })

  return {
    rows,
    source: 'ufc.com/rankings',
    asOf: new Date().toISOString().slice(0, 10),
  }
}

// Orden canónico de divisiones (peso descendente). Los nombres deben coincidir
// con lo que devuelve ufc.com/rankings ('Heavyweight', 'Light Heavyweight'…).
const DIVISION_ORDER_MEN: Array<{ name: string; es: string }> = [
  { name: 'Heavyweight',          es: 'Peso pesado'      },
  { name: 'Light Heavyweight',    es: 'Semipesado'       },
  { name: 'Middleweight',         es: 'Peso medio'       },
  { name: 'Welterweight',         es: 'Wélter'           },
  { name: 'Lightweight',          es: 'Ligero'           },
  { name: 'Featherweight',        es: 'Pluma'            },
  { name: 'Bantamweight',         es: 'Gallo'            },
  { name: 'Flyweight',            es: 'Mosca'            },
]
const DIVISION_ORDER_WOMEN: Array<{ name: string; es: string }> = [
  { name: "Women's Bantamweight", es: 'Gallo (F)'        },
  { name: "Women's Flyweight",    es: 'Mosca (F)'        },
  { name: "Women's Strawweight",  es: 'Paja (F)'         },
]

export async function fetchUfcChampions(): Promise<ScrapeResult | null> {
  let html: string
  try {
    const res = await fetch(URL_RANKINGS, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    html = await res.text()
  } catch { return null }

  const blocks = parseUfcRankings(html)
  if (!blocks.length) return null

  // Mapear nombre de división (en) → bloque
  const byName = new Map(blocks.map(b => [b.name, b]))

  const rows: StandingRow[] = []
  let rank = 1
  for (const div of [...DIVISION_ORDER_MEN, ...DIVISION_ORDER_WOMEN]) {
    const b = byName.get(div.name)
    if (!b || !b.champion) continue
    rows.push({
      rank,
      name: b.champion,
      abbr: div.es,
      value: 'Campeón',
      sub: div.es,
      trend: 'flat',
      extra: { División: div.es },
    })
    rank++
  }

  if (rows.length === 0) return null
  return {
    rows,
    source: 'ufc.com/rankings · campeones',
    asOf: new Date().toISOString().slice(0, 10),
  }
}
