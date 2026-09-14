import { NextResponse } from 'next/server'
import { canonicalPlayerSlug } from '@/lib/player-slug'
import { canonicalTeamSlug } from '@/lib/team-slug'
import { FOOTBALL_LEAGUE_SLUGS } from '@/lib/football-leagues'

export interface SearchHit {
  type: 'player' | 'team'
  name: string
  subtitle: string
  href: string
  logo?: string
}

// Cobertura de fútbol del buscador = LA MISMA que cubre el sitio.
//
// Antes era una lista escrita a mano con las 5 grandes ligas europeas + UEFA,
// bajo la idea de que recortar dejaba los resultados "limpios y pro". El efecto
// real: buscar "Messi" NO devolvía a Messi. Está en la MLS, que el sitio cubre
// —hay calendario, tabla y ficha de equipo— pero el buscador no admitía. El
// único jugador que salía era Junior Messias, del Genoa. Lo mismo con toda
// Liga MX, Brasileirão, Liga Argentina, Championship, Saudi y J-League.
//
// Ahora se deriva de FOOTBALL_LEAGUES, que ya es la fuente única del calendario,
// el feed en vivo y la caché de fotos. Así la regla es una y se explica sola: si
// enseñamos sus partidos, sus jugadores tienen que poder buscarse. Y al añadir
// una liga al sitio, el buscador la gana sin tocar este fichero.
//
// Los slugs del catálogo van como 'soccer/usa.1'; ESPN devuelve 'usa.1'.
// [14/09/2026]
const SOCCER_ALLOWLIST = new Set(
  [...FOOTBALL_LEAGUE_SLUGS].map((s) => s.replace(/^soccer\//, '')),
)

/** Sin acentos y en minúsculas, para comparar "Mbappé" con "mbappe". */
function normaliza(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** DOS bandas, no una nota fina: 1 = alguna palabra del nombre EMPIEZA por lo
 *  buscado · 0 = solo lo contiene por dentro.
 *
 *  Dentro de cada banda se respeta el orden de ESPN, que ya sabe de popularidad.
 *  Se probó puntuar más fino (exacta > empieza > contiene) y salía PEOR: con
 *  "vinicius", el exacto "Vinícius" (un brasileño desconocido) adelantaba a
 *  "Vinícius Júnior". La banda solo sirve para hundir las coincidencias por
 *  dentro, que es lo que descolocaba de verdad: buscando "madrid" salían tres
 *  jugadores apellidados Madrid por delante del Real Madrid. [14/09/2026] */
function banda(nombre: string, q: string): number {
  const n = normaliza(nombre)
  const t = normaliza(q)
  if (!t) return 0
  if (n === t || n.startsWith(t)) return 1
  if (n.split(/\s+/).some((p) => p.startsWith(t))) return 1
  return 0
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
        (sport === 'soccer' && SOCCER_ALLOWLIST.has(league)) ||
        (sport === 'basketball' && league === 'nba')
      if (!supported) continue

      const sportSeg = sport === 'soccer' ? 'soccer' : 'basketball'
      const leagueSeg = league.replaceAll('/', '_')

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
          href: `/jugador/${canonicalPlayerSlug(name, id)}`,
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
          href: `/equipo/${canonicalTeamSlug(name, id)}`,
          logo: sport === 'soccer'
            ? `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`
            : undefined,
        })
      }
    }
  }

  // El recorte a 12 se hace AL FINAL, no durante la recogida. Antes se cortaba
  // en cuanto había 12 candidatos, así que una coincidencia buena que ESPN
  // devolviera tarde no llegaba a competir: se perdía sin haberla comparado.
  // Array.sort es estable, así que a igualdad de banda y tipo se conserva el
  // orden de llegada, que es el de ESPN.
  hits.sort((a, b) => {
    const ba = banda(a.name, q)
    const bb = banda(b.name, q)
    if (ba !== bb) return bb - ba
    // A igualdad de banda, el club primero: cuando alguien escribe el nombre de
    // un equipo, suele querer el equipo.
    if (a.type !== b.type) return a.type === 'team' ? -1 : 1
    return 0
  })
  return NextResponse.json({ hits: hits.slice(0, 12) })
}
