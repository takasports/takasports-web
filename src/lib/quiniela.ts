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
  /** true = partido anulado (pospuesto/cancelado/forfeit). En ese caso
   *  el pick no cuenta como acierto ni fallo, y el stake se devuelve
   *  íntegro al wallet en el settle. */
  cancelled?: boolean
  /** Partido destacado de la jornada — si el user lo acierta, sus
   *  points y coins por ese pick se duplican (T). No hay penalty por
   *  fallarlo. Cancelados no aplican x2 (refund íntegro). */
  featured?: boolean
}

// Etiqueta visible del resultado (L/E/V). El valor interno sigue
// siendo '1'/'X'/'2' para API, scoring y compatibilidad.
export const OUTCOME_LABEL: Record<Outcome, string> = { '1': 'L', 'X': 'E', '2': 'V' }

export interface SavedPick {
  home: string
  away: string
  pick: Pick
  // Cuota congelada de la opción elegida en el momento de sellar
  // (como una apuesta real: el multiplicador queda fijo). Multiplica
  // las monedas ganadas si el pick acierta. En el modo Ranked es
  // obligatoria — sin cuotas reales (the-odds-api caída) la jornada
  // se bloquea aparte.
  oddsAtPick?: number
  // Monedas apostadas en este pick (Ranked). Se descuentan del wallet
  // al sellar, se devuelven multiplicadas por la cuota si acierta. En
  // ligas privadas (que son por puntos, no monedas) este campo se
  // ignora — el scoring de standings no lo usa.
  // Min 1, max 200, default 10 — validado server-side.
  stake?: number
  /** Marcador exacto predicho (opcional). Si el user lo añade Y la
   *  tendencia es correcta Y los goles coinciden exactamente, gana
   *  SCORING.EXACT_BONUS adicional (puntos y coins). Máximo 3 picks
   *  con exactScore por jornada — validado server-side. Si está
   *  presente pero no coincide o la tendencia falla, no aplica nada
   *  y no hay penalty. Goles enteros 0-20 cada uno. */
  exactScore?: { home: number; away: number }
}

// ── Normalización de nombres ─────────────────────────────────────
export const TEAM_ALIASES: Record<string, string> = {
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

// ── Sistema de puntuación: dos pistas paralelas ────────────────────
//
// RANKED (modo principal, por monedas):
//   · Coins ganadas por pick acertado = stake × cuota
//   · Stake se descuenta al sellar; las ganancias se acreditan al cierre.
//   · Sin acertar = pierde el stake (ya descontado, no se devuelve).
//   · +COINS_PARTICIPATE por sellar (engagement diario).
//   · +COINS_PLENO si acierta tendencia en TODOS los picks (bonus).
//
// LIGAS PRIVADAS (modo amigos, por puntos):
//   · 1 punto por tendencia acertada.
//   · +PLENO_BONUS si acierta todos.
//   · NO usa stake, NO usa cuotas, NO acredita monedas.
//   · Ranking interno cosmético.
//
// scorePick + scorePicks devuelven ambas pistas (points + coins) y el
// consumidor decide cuál usar según el contexto.
export const SCORING = {
  // Puntos (ligas privadas)
  TENDENCY: 1,
  PLENO_BONUS: 5,
  /** Bonus por acertar el marcador EXACTO del partido. Se suma a
   *  points y coins por separado. Solo aplica si la tendencia
   *  también es correcta. Si el partido es featured, este bonus
   *  también se duplica (mismo trato que TENDENCY). NO suma al
   *  pleno (el pleno sigue siendo de tendencia). */
  EXACT_BONUS: 3,
  /** Máximo nº de picks con exactScore por jornada. Server-side. */
  MAX_EXACT_PER_JORNADA: 3,
  // Coins (Ranked)
  COINS_PARTICIPATE: 5,
  /** Bonus mínimo de pleno: garantiza un piso para apostadores muy
   *  conservadores (totalStake bajo). El bonus efectivo se calcula
   *  como max(totalStake, COINS_PLENO_FLOOR) — el pleno escala con
   *  la apuesta total para no sentirse irrisorio con stakes grandes. */
  COINS_PLENO_FLOOR: 100,
  // Stake (Ranked)
  STAKE_MIN: 1,
  STAKE_MAX: 200,
  STAKE_DEFAULT: 10,
} as const

export interface PickScore {
  hit: boolean         // tendencia correcta (false si cancelled)
  /** true = el partido fue anulado. El stake se devuelve íntegro
   *  en `refund`, y el pick NO cuenta como hit ni como fallo. */
  cancelled: boolean
  points: number       // puntos (ligas privadas) — 0 o TENDENCY (+EXACT_BONUS si exact, x2 si featured)
  coins: number        // monedas Ranked ganadas (stake × cuota) si acierta, 0 si no (+EXACT_BONUS si exact, x2 si featured)
  refund: number       // stake devuelto si partido cancelado, 0 normalmente
  stake: number        // stake declarado del pick (0 si no se apostó / liga privada)
  oddsApplied: number  // cuota efectiva usada en el cálculo
  /** true cuando el partido era featured Y el user acertó → se aplicó x2.
   *  Sirve para que la UI muestre el badge "⭐ x2" sobre ese pick. */
  featuredBonus?: boolean
  /** true cuando el user predijo marcador exacto Y coincide con el
   *  resultado real Y la tendencia es correcta → se aplicó +EXACT_BONUS. */
  exactBonus?: boolean
}

export interface ScoreBreakdown {
  perPick: PickScore[]
  hits: number          // nº de picks con tendencia correcta
  pleno: boolean        // pleno calcula sobre picks NO cancelados
  totalPoints: number   // suma de points + pleno bonus
  totalCoins: number    // suma de coins (Ranked) + pleno bonus de coins
  totalStake: number    // suma de stakes apostados (validación de saldo)
  totalRefund: number   // suma de stakes devueltos por partidos anulados
  cancelledCount: number // nº de picks anulados
  /** true cuando el user acertó el partido featured y por tanto recibió
   *  el bonus x2. Solo uno por jornada como máximo. */
  featuredHit?: boolean
  /** Nº de picks con marcador exacto acertado (tendencia correcta Y
   *  goles exactos). 0..MAX_EXACT_PER_JORNADA. */
  exactHits?: number
}

export function scorePick(
  pick: SavedPick,
  result: MatchResult | undefined,
): PickScore {
  const stake = pick.stake ?? 0
  if (!result) {
    return { hit: false, cancelled: false, points: 0, coins: 0, refund: 0, stake, oddsApplied: 1 }
  }

  // Partido anulado: el pick no compite. Devolvemos el stake íntegro
  // (refund) y NO contamos hit ni fallo. points=0, coins=0.
  if (result.cancelled) {
    return {
      hit: false,
      cancelled: true,
      points: 0,
      coins: 0,
      refund: stake,
      stake,
      oddsApplied: 1,
    }
  }

  const hit = isCorrect(pick.pick, result.outcome)

  // Cuota efectiva = cuota congelada del pick en el momento de sellar.
  // Sin cuota real (the-odds-api caída) → ×1, pero el flow Ranked debería
  // bloquear la jornada antes de llegar aquí (validación aparte).
  const baseOdd = Math.max(1, pick.oddsAtPick ?? 1)
  const oddsApplied = hit ? baseOdd : 1

  // Puntos (ligas privadas): tendencia binaria. No depende de cuota ni stake.
  let points = hit ? SCORING.TENDENCY : 0

  // Coins (Ranked): stake × cuota efectiva si acierta. 0 si falla
  // (el stake ya fue descontado al sellar, no se devuelve).
  let coins = hit && stake > 0 ? Math.round(stake * oddsApplied) : 0

  // E1 — Bonus por marcador exacto. Solo aplica si:
  //   1. tendencia es correcta (hit)
  //   2. user predijo un marcador exacto (pick.exactScore)
  //   3. los goles del resultado coinciden bit a bit con la predicción
  // Si cualquiera de las 3 falla → no bonus, no penalty.
  // Se suma a points y coins ANTES del multiplicador featured para que
  // featured x2 doble también el bonus (consistente con T).
  const exactBonus = !!(
    hit &&
    pick.exactScore &&
    Number.isFinite(pick.exactScore.home) &&
    Number.isFinite(pick.exactScore.away) &&
    pick.exactScore.home === result.homeGoals &&
    pick.exactScore.away === result.awayGoals
  )
  if (exactBonus) {
    points += SCORING.EXACT_BONUS
    coins  += SCORING.EXACT_BONUS
  }

  // T — Bonus x2 sobre puntos Y coins si el partido era featured y se
  // acertó la tendencia. NO afecta stake ni refund: si fallas el featured
  // no hay penalty extra. Solo el upside está duplicado. Si encima clavaste
  // el exact, ese bonus también se duplica (orden correcto arriba).
  const featuredBonus = hit && result.featured === true
  if (featuredBonus) {
    points *= 2
    coins *= 2
  }

  return { hit, cancelled: false, points, coins, refund: 0, stake, oddsApplied, featuredBonus, exactBonus }
}

export function scorePicks(
  picks: SavedPick[],
  results: MatchResult[],
): ScoreBreakdown {
  const perPick = picks.map(p => {
    const r = results.find(rr => nameMatch(rr.home, p.home) && nameMatch(rr.away, p.away))
    return scorePick(p, r)
  })
  const hits = perPick.filter(s => s.hit).length
  const cancelledCount = perPick.filter(s => s.cancelled).length
  // Pleno se calcula sobre picks NO cancelados — anulado ≠ fallo.
  // Ejemplo: 6 picks, 1 cancelado, 5 aciertos → pleno (5 de 5 jugados).
  const playable = picks.length - cancelledCount
  const pleno = playable > 0 && hits === playable
  const totalStake = perPick.reduce((a, s) => a + s.stake, 0)
  const totalRefund = perPick.reduce((a, s) => a + s.refund, 0)
  let totalPoints = perPick.reduce((a, s) => a + s.points, 0)
  let totalCoins  = perPick.reduce((a, s) => a + s.coins, 0)
  if (pleno) {
    totalPoints += SCORING.PLENO_BONUS
    // Bonus pleno escalado: equivalente a recuperar el stake total como
    // bonus (double-down efectivo sobre todas tus apuestas). Garantiza
    // un piso COINS_PLENO_FLOOR para que stakes muy chicos no den un
    // bonus ridículo (alguien que apuesta 1🪙 por pick sigue ganando 100).
    totalCoins  += Math.max(SCORING.COINS_PLENO_FLOOR, totalStake)
  }
  const featuredHit = perPick.some(s => s.featuredBonus === true)
  const exactHits = perPick.filter(s => s.exactBonus === true).length
  return { perPick, hits, pleno, totalPoints, totalCoins, totalStake, totalRefund, cancelledCount, featuredHit, exactHits }
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
