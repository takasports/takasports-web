import { NextResponse } from 'next/server'

export interface SearchHit {
  type: 'player' | 'team'
  name: string
  subtitle: string
  href: string
  logo?: string
}

// Curated allowlist: only top-5 European leagues + UEFA club competitions.
// /jugador self-resolves the real domestic league from the ESPN overview, so
// a uefa.champions-tagged Mbappé still shows LaLiga stats. Excluding cups,
// lower divisions and women keeps the results clean and "pro".
const SOCCER_ALLOWLIST = new Set([
  'esp.1', 'eng.1', 'ita.1', 'ger.1', 'fra.1',
  'uefa.champions', 'uefa.europa', 'uefa.conference',
])

function idFromUid(uid: string, kind: 'a' | 't'): string | undefined {
  const m = uid.match(new RegExp(`~${kind}:(\\d+)`))
  return m?.[1]
}

interface EspnContent {
  displayName?: string
  subtitle?: string
  sport?: string
  defaultLeagueSlug?: string
  uid?: string
}
interface EspnGroup { type?: string; contents?: EspnContent[] }

export const revalidate = 3600

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ hits: [] })

  let groups: EspnGroup[] = []
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(q)}&limit=20`,
      { next: { revalidate: 3600 } },
    )
    if (res.ok) groups = ((await res.json()).results ?? []) as EspnGroup[]
  } catch { /* ESPN down → empty */ }

  const hits: SearchHit[] = []
  const seen = new Set<string>()

  for (const g of groups) {
    if (g.type !== 'player' && g.type !== 'team') continue
    for (const c of g.contents ?? []) {
      const sport = c.sport
      const league = c.defaultLeagueSlug ?? ''
      const uid = c.uid ?? ''
      const name = c.displayName ?? ''
      if (!name || !uid) continue

      const supported =
        (sport === 'soccer' && SOCCER_ALLOWLIST.has(league)) ||
        (sport === 'basketball' && league === 'nba')
      if (!supported) continue

      const sportSeg = sport === 'soccer' ? 'soccer' : 'basketball'
      const leagueSeg = league.replace('/', '_')

      if (g.type === 'player') {
        const id = idFromUid(uid, 'a')
        if (!id) continue
        const key = `p:${id}`
        if (seen.has(key)) continue
        seen.add(key)
        hits.push({
          type: 'player',
          name,
          subtitle: c.subtitle || (sport === 'soccer' ? league.toUpperCase() : 'NBA'),
          href: `/jugador/${sportSeg}_${leagueSeg}_${id}`,
        })
      } else {
        const id = idFromUid(uid, 't')
        if (!id) continue
        const key = `t:${sportSeg}:${id}`
        if (seen.has(key)) continue
        seen.add(key)
        hits.push({
          type: 'team',
          name,
          subtitle: c.subtitle || (sport === 'soccer' ? league.toUpperCase() : 'NBA'),
          href: `/equipo/${sportSeg}_${leagueSeg}_${id}`,
          logo: sport === 'soccer'
            ? `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`
            : undefined,
        })
      }
      if (hits.length >= 12) break
    }
    if (hits.length >= 12) break
  }

  // Teams first (usually the intent when the query matches a club).
  hits.sort((a, b) => (a.type === b.type ? 0 : a.type === 'team' ? -1 : 1))
  return NextResponse.json({ hits })
}
