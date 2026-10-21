// Cara a cara de FÚTBOL a partir del summary de ESPN (coste 0: viaja en la misma
// respuesta que ya pide /api/match). Una fuente → web y app ven lo mismo.
//
// ESPN cambió la forma: el summary de fútbol ya NO trae `headToHeadGames` (el
// campo que leía la ficha). Ahora el cara a cara viene en `seasonseries`, una
// entrada `type: 'head-to-head'` con los últimos 5 enfrentamientos en cualquier
// competición. Comprobado el 21/10/2026 en LaLiga, Liga Argentina, J1, Champions
// y Liga de Naciones: ninguno traía `headToHeadGames`. Resultado: la app no
// enseñaba ningún cara a cara de fútbol, y la web caía a nuestro archivo
// (past_events), que solo tiene lo que hemos guardado — «Sin enfrentamientos
// previos» en el Levante-Athletic o el Gimnasia-Sarmiento, que tienen cinco.
//
// Se leen las dos formas: la antigua primero (por si vuelve) y, si no, la nueva.

import type { H2HMatch, H2HResult } from '@/lib/past-events'

type J = Record<string, unknown>
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const obj = (v: unknown): J | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as J) : undefined)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

export function numOrNull(v: unknown): number | null {
  if (typeof v === 'number') return Number.isNaN(v) ? null : v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return null
}

type Tally = { wins: number; draws: number; losses: number }

/** Suma el resultado al balance, visto desde el equipo LOCAL del partido actual. */
function tally(t: Tally, homeTeamId: string | undefined, rowHomeId: string | undefined, hs: number | null, as: number | null) {
  if (!homeTeamId || hs == null || as == null) return
  const cur = rowHomeId === homeTeamId ? hs : as
  const opp = rowHomeId === homeTeamId ? as : hs
  if (cur > opp) t.wins++
  else if (cur < opp) t.losses++
  else t.draws++
}

function finish(matches: H2HMatch[], t: Tally): H2HResult | undefined {
  if (!matches.length) return undefined
  matches.sort((a, b) => (b.isoDate || '').localeCompare(a.isoDate || ''))
  return { matches, ...t }
}

// Forma antigua: headToHeadGames[] = { team, events[] } por cada equipo.
function fromHeadToHeadGames(json: J, homeTeamId: string | undefined, translate: (s: string) => string): H2HResult | undefined {
  const groups = arr(json.headToHeadGames) as J[]
  if (!groups.length) return undefined
  const seen = new Set<string>()
  const matches: H2HMatch[] = []
  const t: Tally = { wins: 0, draws: 0, losses: 0 }
  for (const g of groups) {
    for (const ev of arr(g.events) as J[]) {
      const id = str(ev.id) ?? ''
      if (id && seen.has(id)) continue   // el mismo cruce aparece en ambos equipos
      if (id) seen.add(id)
      const hId = str(ev.homeTeamId)
      const aId = str(ev.awayTeamId)
      const hScore = numOrNull(ev.homeTeamScore)
      const aScore = numOrNull(ev.awayTeamScore)
      const gTeam = obj(g.team)
      const opp = obj(ev.opponent)
      const gTeamId = str(gTeam?.id)
      const pick = (side: 'home' | 'away', key: string) => {
        const sideId = side === 'home' ? hId : aId
        return sideId === gTeamId ? str(gTeam?.[key]) : str(opp?.[key])
      }
      const name = (side: 'home' | 'away') => {
        const raw = pick(side, 'displayName')
        return raw ? translate(raw) : raw
      }
      matches.push({
        id: id || `${hId}-${aId}-${str(ev.gameDate) ?? ''}`,
        isoDate: str(ev.gameDate) ?? '',
        comp: str(ev.leagueName) ?? str(ev.competitionName) ?? '',
        home: name('home') ?? '—',
        away: name('away') ?? '—',
        homeScore: hScore,
        awayScore: aScore,
        homeLogo: pick('home', 'logo'),
        awayLogo: pick('away', 'logo'),
        homeAbbr: pick('home', 'abbreviation'),
        awayAbbr: pick('away', 'abbreviation'),
      })
      tally(t, homeTeamId, hId, hScore, aScore)
    }
  }
  return finish(matches, t)
}

// Forma actual: seasonseries[] con type 'head-to-head' → events[] con competitors.
function fromSeasonSeries(json: J, homeTeamId: string | undefined, translate: (s: string) => string): H2HResult | undefined {
  const all = arr(json.seasonseries) as J[]
  const h2h = all.filter(s => str(s.type) === 'head-to-head')
  const series = h2h.length ? h2h : all
  if (!series.length) return undefined
  const currentId = str(obj(json.header)?.id)
  const seen = new Set<string>()
  const matches: H2HMatch[] = []
  const t: Tally = { wins: 0, draws: 0, losses: 0 }
  for (const s of series) {
    for (const ev of arr(s.events) as J[]) {
      const id = str(ev.id) ?? ''
      if (id && (seen.has(id) || id === currentId)) continue
      if (id) seen.add(id)
      // Solo jugados: el cara a cara no cuenta partidos por disputar.
      const st = obj(ev.statusType)
      if (!(st?.completed === true || str(ev.status) === 'post')) continue
      const cs = arr(ev.competitors) as J[]
      const homeC = cs.find(c => str(c.homeAway) === 'home') ?? cs[0]
      const awayC = cs.find(c => str(c.homeAway) === 'away') ?? cs[1]
      if (!homeC || !awayC) continue
      const hT = obj(homeC.team), aT = obj(awayC.team)
      const hScore = numOrNull(homeC.score), aScore = numOrNull(awayC.score)
      const tr = (v: unknown) => { const n = str(v); return n ? translate(n) : n }
      matches.push({
        id: id || `${str(hT?.id)}-${str(aT?.id)}-${str(ev.date) ?? ''}`,
        isoDate: str(ev.date) ?? '',
        comp: str(ev.competitionName) ?? '',
        home: tr(hT?.displayName) ?? str(hT?.abbreviation) ?? '—',
        away: tr(aT?.displayName) ?? str(aT?.abbreviation) ?? '—',
        homeScore: hScore,
        awayScore: aScore,
        homeLogo: str(hT?.logo),
        awayLogo: str(aT?.logo),
        homeAbbr: str(hT?.abbreviation),
        awayAbbr: str(aT?.abbreviation),
      })
      tally(t, homeTeamId, str(hT?.id), hScore, aScore)
    }
  }
  return finish(matches, t)
}

export function buildSoccerH2H(
  json: J,
  homeTeamId?: string,
  translate: (s: string) => string = (s) => s,
): H2HResult | undefined {
  return fromHeadToHeadGames(json, homeTeamId, translate) ?? fromSeasonSeries(json, homeTeamId, translate)
}
