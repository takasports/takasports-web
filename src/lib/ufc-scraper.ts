// Scraper UFC rankings vía ufc.com/rankings (HTML scrape, sin auth, sin coste).
// ESPN tiene los rankings de UFC desactualizados desde que UFC y ESPN no son
// socios; ufc.com es la fuente oficial canónica.
import type { StandingRow } from './stats-editorial'
import type { ScrapeResult } from './motogp-scraper'

const URL_RANKINGS = 'https://www.ufc.com/rankings'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const CACHE_MS = 60_000

interface DivisionBlock {
  name: string
  champion: string | null
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

// Normaliza el nombre de división para un match resiliente a variaciones de
// ufc.com (apóstrofes “'” vs “’”, espacios dobles, mayúsculas). Sin esto, las
// divisiones femeninas ("Women's …") fallaban el match exacto a ratos y el
// snapshot quedaba viejo una semana entera.
function normDiv(s: string): string {
  return s.toLowerCase().replace(/['’`]/g, '').replace(/\s+/g, ' ').trim()
}

function parseUfcRankings(html: string): DivisionBlock[] {
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
      if (seenRanks.has(rank) && contenders.length >= 10) continue
      seenRanks.add(rank)
      contenders.push({ rank, name: fname })
      if (contenders.length >= 15) break
    }
    out.push({ name, champion, contenders })
  }
  return out
}

// Cache module-level: una sola fetch HTML sirve a los 11+ blockIds que se
// piden en el mismo cron run (P4P + Champions + 11 divisiones).
let _cache: { ts: number; blocks: DivisionBlock[] } | null = null
async function getRankings(): Promise<DivisionBlock[]> {
  if (_cache && Date.now() - _cache.ts < CACHE_MS) return _cache.blocks
  try {
    const res = await fetch(URL_RANKINGS, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const html = await res.text()
    const blocks = parseUfcRankings(html)
    _cache = { ts: Date.now(), blocks }
    return blocks
  } catch { return [] }
}

function buildChampionDivisionMap(blocks: DivisionBlock[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const b of blocks) {
    if (/pound-for-pound|p4p/i.test(b.name)) continue
    if (b.champion) m.set(b.champion, b.name)
  }
  return m
}

export async function fetchUfcP4P(): Promise<ScrapeResult | null> {
  const blocks = await getRankings()
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
  return { rows, source: 'ufc.com/rankings', asOf: new Date().toISOString().slice(0, 10) }
}

// ─── División config (block_id ↔ nombre UFC ↔ label ES) ────────────────
export interface DivisionConfig {
  blockId: string
  ufcName: string
  label: string  // ES para mostrar en UI
  metaKey: string  // key en StatsStandingsResponse
}

export const UFC_DIVISIONS: DivisionConfig[] = [
  // Masculino (de pesado a mosca)
  { blockId: 'ufc-hw',     ufcName: 'Heavyweight',          label: 'Peso pesado',  metaKey: 'ufcHeavyweight' },
  { blockId: 'ufc-lhw',    ufcName: 'Light Heavyweight',    label: 'Semipesado',   metaKey: 'ufcLightHeavyweight' },
  { blockId: 'ufc-mw',     ufcName: 'Middleweight',         label: 'Peso medio',   metaKey: 'ufcMiddleweight' },
  { blockId: 'ufc-ww',     ufcName: 'Welterweight',         label: 'Wélter',       metaKey: 'ufcWelterweight' },
  { blockId: 'ufc-lw',     ufcName: 'Lightweight',          label: 'Ligero',       metaKey: 'ufcLightweight' },
  { blockId: 'ufc-fw',     ufcName: 'Featherweight',        label: 'Pluma',        metaKey: 'ufcFeatherweight' },
  { blockId: 'ufc-bw',     ufcName: 'Bantamweight',         label: 'Gallo',        metaKey: 'ufcBantamweight' },
  { blockId: 'ufc-flw',    ufcName: 'Flyweight',            label: 'Mosca',        metaKey: 'ufcFlyweight' },
  // Femenino
  { blockId: 'ufc-w-bw',   ufcName: "Women's Bantamweight", label: 'Gallo (F)',    metaKey: 'ufcWomenBantamweight' },
  { blockId: 'ufc-w-flw',  ufcName: "Women's Flyweight",    label: 'Mosca (F)',    metaKey: 'ufcWomenFlyweight' },
  { blockId: 'ufc-w-stw',  ufcName: "Women's Strawweight",  label: 'Paja (F)',     metaKey: 'ufcWomenStrawweight' },
]

export async function fetchUfcChampions(): Promise<ScrapeResult | null> {
  const blocks = await getRankings()
  if (!blocks.length) return null
  const byName = new Map(blocks.map(b => [normDiv(b.name), b]))

  const rows: StandingRow[] = []
  let rank = 1
  for (const div of UFC_DIVISIONS) {
    const b = byName.get(normDiv(div.ufcName))
    if (!b || !b.champion) continue
    rows.push({
      rank,
      name: b.champion,
      abbr: div.label,
      value: 'Campeón',
      sub: div.label,
      trend: 'flat',
      extra: { División: div.label },
    })
    rank++
  }
  if (rows.length === 0) return null
  return { rows, source: 'ufc.com/rankings · campeones', asOf: new Date().toISOString().slice(0, 10) }
}

// Devuelve top 5 contendientes + champion como rank 1 para UNA división.
export function makeDivisionFetcher(div: DivisionConfig) {
  return async (): Promise<ScrapeResult | null> => {
    const blocks = await getRankings()
    if (!blocks.length) return null
    const block = blocks.find(b => normDiv(b.name) === normDiv(div.ufcName))
    if (!block) return null

    const rows: StandingRow[] = []
    if (block.champion) {
      rows.push({
        rank: 1,
        name: block.champion,
        abbr: 'C',
        value: 'Campeón',
        sub: 'Campeón actual',
        trend: 'flat',
        extra: { Estado: 'Campeón' },
      })
    }
    const startRank = rows.length + 1
    for (const c of block.contenders.slice(0, 5)) {
      // Skip si es el mismo nombre del campeón (UFC.com a veces lo lista en #1)
      if (block.champion && c.name === block.champion) continue
      rows.push({
        rank: startRank + (c.rank - 1),
        name: c.name,
        abbr: '',
        value: `#${c.rank}`,
        sub: `Contendiente`,
        trend: 'flat' as const,
        extra: {},
      })
      if (rows.length >= 6) break
    }
    if (rows.length === 0) return null
    return {
      rows,
      source: `ufc.com · ${div.label}`,
      asOf: new Date().toISOString().slice(0, 10),
    }
  }
}
