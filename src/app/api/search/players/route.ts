import { NextResponse } from 'next/server'

export interface SearchHit {
  type: 'player' | 'team'
  name: string
  subtitle: string
  href: string
  logo?: string
}

// /jugador self-resolves the player's real domestic league from the ESPN
// overview, so we accept any men's soccer competition slug here. We only
// exclude women's / youth / college comps which we don't surface.
function soccerOk(league: string): boolean {
  if (!league) return false
  return !/\.w\.|women|college|youth|u\d{2}/i.test(league)
}

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
        (sport === 'soccer' && soccerOk(league)) ||
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
