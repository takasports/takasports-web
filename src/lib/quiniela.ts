// ─────────────────────────────────────────────────────────────────
// Quiniela — lógica compartida cliente/servidor
// Una sola fuente de verdad para nombres, scoring y constantes.
// ─────────────────────────────────────────────────────────────────

export type Pick = '1' | 'X' | '2' | '1X' | 'X2'
export type Outcome = '1' | 'X' | '2'

export interface MatchResult {
  home: string
  away: string
  homeGoals: number
  awayGoals: number
  outcome: Outcome
  espnId?: string
}

// Etiqueta visible del resultado (L/E/V). El valor interno sigue
// siendo '1'/'X'/'2' para API, scoring y compatibilidad.
export const OUTCOME_LABEL: Record<Outcome, string> = { '1': 'L', 'X': 'E', '2': 'V' }

export interface SavedPick {
  home: string
  away: string
  pick: Pick
  exactHome?: number
  exactAway?: number
  // Cuota congelada de la opción elegida en el momento de sellar
  // (como una apuesta real: el multiplicador queda fijo). Multiplica
  // monedas y puntos si el pick acierta. Ausente → multiplicador 1.
  oddsAtPick?: number
}

// ── Normalización de nombres ─────────────────────────────────────
const TEAM_ALIASES: Record<string, string> = {
  'psg':           'paris saint-germain',
  'paris':         'paris saint-germain',
  'bayern':        'bayern munich',
  'atletico':      'atletico madrid',
  'atletico de madrid': 'atletico madrid',
  'atl madrid':    'atletico madrid',
  'man city':      'manchester city',
  'man united':    'manchester united',
  'man utd':       'manchester united',
  'nottm forest':  'nottingham forest',
  'newcastle':     'newcastle united',
  'spurs':         'tottenham hotspur',
  'tottenham':     'tottenham hotspur',
  'inter':         'inter milan',
  'ac milan':      'ac milan',
  'milan':         'ac milan',
  'roma':          'as roma',
  'betis':         'real betis',
  'real betis balompie': 'real betis',
  'sociedad':      'real sociedad',
  'bvb':           'borussia dortmund',
  'dortmund':      'borussia dortmund',
  'gladbach':      'borussia monchengladbach',
  'frankfurt':     'eintracht frankfurt',
  'leverkusen':    'bayer leverkusen',
  'bayer':         'bayer leverkusen',
  'leipzig':       'rb leipzig',
  'porto':         'fc porto',
  'benfica':       'sl benfica',
  'sporting':      'sporting cp',
  'lyon':          'olympique lyonnais',
  'marseille':     'olympique de marseille',
  'monaco':        'as monaco',
  'west ham':      'west ham united',
  'wolves':        'wolverhampton wanderers',
  'wolverhampton': 'wolverhampton wanderers',
  'brighton':      'brighton & hove albion',
  'leicester':     'leicester city',
  'ipswich':       'ipswich town',
}

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim()
}

export function resolveAlias(name: string): string {
  const n = normalize(name)
  return TEAM_ALIASES[n] ?? n
}

export function nameMatch(a: string, b: string): boolean {
  const na = resolveAlias(a), nb = resolveAlias(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

// ── Validación de pick contra resultado ──────────────────────────
export function isCorrect(pick: Pick, outcome: Outcome): boolean {
  if (pick === outcome) return true
  if (pick === '1X') return outcome === '1' || outcome === 'X'
  if (pick === 'X2') return outcome === 'X' || outcome === '2'
  return false
}

// ── Sistema de puntuación tiered (estilo Superbru) ───────────────
//  · 1pt   tendencia correcta (1/X/2)
//  · +0.5  diferencia de goles correcta
//  · +1.5  marcador exacto (total 3pt)
//  · ×2    si es el capitán (multiplica TODO el pick)
//  · +5    pleno (todos los picks correctos en tendencia)
export const SCORING = {
  TENDENCY: 1,
  GOAL_DIFF: 0.5,
  EXACT_BONUS: 1.5, // se suma encima de TENDENCY+GOAL_DIFF
  CAPTAIN_MULTIPLIER: 2,
  PLENO_BONUS: 5,
  // Coins (recompensa económica del juego — NO confundir con puntos)
  COINS_PER_HIT: 10,
  COINS_PER_EXACT: 50,
  COINS_PLENO: 100,
  COINS_PARTICIPATE: 5,
} as const

export interface PickScore {
  hit: boolean        // tendencia correcta
  goalDiff: boolean   // diferencia de goles correcta
  exact: boolean      // marcador exacto
  isCaptain: boolean
  points: number      // puntos finales (con multiplicador capitán aplicado)
  coins: number       // monedas ganadas por este pick
}

export interface ScoreBreakdown {
  perPick: PickScore[]
  hits: number          // nº de picks con tendencia correcta
  exacts: number
  pleno: boolean
  totalPoints: number
  totalCoins: number
}

export function scorePick(
  pick: SavedPick,
  result: MatchResult | undefined,
  isCaptain: boolean,
): PickScore {
  if (!result) {
    return { hit: false, goalDiff: false, exact: false, isCaptain, points: 0, coins: 0 }
  }
  const hit = isCorrect(pick.pick, result.outcome)
  const exact =
    hit &&
    pick.exactHome != null &&
    pick.exactAway != null &&
    pick.exactHome === result.homeGoals &&
    pick.exactAway === result.awayGoals
  const goalDiff =
    hit &&
    !exact &&
    pick.exactHome != null &&
    pick.exactAway != null &&
    (pick.exactHome - pick.exactAway) === (result.homeGoals - result.awayGoals)

  // La cuota congelada es el multiplicador de riesgo: acertar una
  // opción improbable (cuota alta) paga más en monedas y puntos.
  // Sin cuota (proveedor sin datos) → ×1 (comportamiento plano previo).
  const oddsMult = hit ? Math.max(1, pick.oddsAtPick ?? 1) : 1

  let points = 0
  if (hit) points += SCORING.TENDENCY
  if (goalDiff) points += SCORING.GOAL_DIFF
  if (exact) points += SCORING.EXACT_BONUS + SCORING.GOAL_DIFF
  points *= oddsMult
  if (isCaptain) points *= SCORING.CAPTAIN_MULTIPLIER
  points = Math.round(points * 10) / 10

  let coins = 0
  if (hit) coins += SCORING.COINS_PER_HIT * oddsMult
  if (exact) coins += SCORING.COINS_PER_EXACT
  if (isCaptain) coins *= SCORING.CAPTAIN_MULTIPLIER // el capitán dobla todo el pick
  coins = Math.round(coins)

  return { hit, goalDiff, exact, isCaptain, points, coins }
}

export function scorePicks(
  picks: SavedPick[],
  results: MatchResult[],
  captainIdx?: number,
): ScoreBreakdown {
  const perPick = picks.map((p, i) => {
    const r = results.find(rr => nameMatch(rr.home, p.home) && nameMatch(rr.away, p.away))
    return scorePick(p, r, captainIdx === i)
  })
  const hits = perPick.filter(s => s.hit).length
  const exacts = perPick.filter(s => s.exact).length
  const pleno = picks.length > 0 && hits === picks.length
  let totalPoints = perPick.reduce((a, s) => a + s.points, 0)
  let totalCoins  = perPick.reduce((a, s) => a + s.coins, 0)
  if (pleno) {
    totalPoints += SCORING.PLENO_BONUS
    totalCoins  += SCORING.COINS_PLENO
  }
  return { perPick, hits, exacts, pleno, totalPoints, totalCoins }
}

// ── Validación de cierre por kickoff ─────────────────────────────
// Devuelve los índices que YA están bloqueados (kickoff en pasado)
// con un margen de gracia opcional (por defecto 0).
export function lockedIndices(
  matches: { isoDate?: string }[],
  graceSeconds = 0,
  now = Date.now(),
): Set<number> {
  const set = new Set<number>()
  matches.forEach((m, i) => {
    if (!m.isoDate) return
    const k = new Date(m.isoDate).getTime()
    if (Number.isNaN(k)) return
    if (k - graceSeconds * 1000 <= now) set.add(i)
  })
  return set
}

// ── ISO week con timezone ────────────────────────────────────────
// Formato: YYYY-Www en la zona horaria indicada (default Europe/Madrid)
export function isoWeek(date: Date = new Date(), timeZone = 'Europe/Madrid'): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const y = Number(parts.find(p => p.type === 'year')!.value)
  const m = Number(parts.find(p => p.type === 'month')!.value)
  const d = Number(parts.find(p => p.type === 'day')!.value)
  // ISO week algo (Mon=1..Sun=7)
  const target = new Date(Date.UTC(y, m - 1, d))
  const dayNum = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(
    ((target.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  )
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
