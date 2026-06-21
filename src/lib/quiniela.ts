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
  /** true = partido anulado (pospuesto/cancelado/forfeit). El pick no
   *  cuenta como acierto ni fallo. */
  cancelled?: boolean
  /** Partido destacado de la jornada — si el user lo acierta, sus puntos
   *  por ese pick se duplican (x2). No hay penalty por fallarlo. */
  featured?: boolean
}

// Etiqueta visible del resultado (L/E/V). El valor interno sigue
// siendo '1'/'X'/'2' para API, scoring y compatibilidad.
export const OUTCOME_LABEL: Record<Outcome, string> = { '1': 'L', 'X': 'E', '2': 'V' }

export interface SavedPick {
  home: string
  away: string
  pick: Pick
  // Cuota congelada de la opción elegida al sellar. Dato informativo:
  // NO se apuesta dinero. Se conserva porque alimenta el badge "underdog"
  // (acertar un pick con cuota alta) y se puede mostrar en la UI.
  oddsAtPick?: number
  /** Marcador exacto predicho (opcional). Si el user lo añade Y la
   *  tendencia es correcta Y los goles coinciden exactamente, gana
   *  SCORING.EXACT_BONUS adicional. Máximo 3 picks con exactScore por
   *  jornada — validado server-side. Si está presente pero no coincide
   *  o la tendencia falla, no aplica nada y no hay penalty. Goles
   *  enteros 0-20 cada uno. */
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

// Empareja dos nombres de equipo tolerando variantes (alias, acentos,
// puntuación y sufijos/prefijos "FC"/"CF"/"United"/"AFC"…). Empareja por
// PALABRA COMPLETA, no por subcadena suelta: así "Brighton" casa con
// "Brighton & Hove Albion" y "Real Betis" con "Real Betis Balompié", pero
// los nombres cortos (sobre todo de selección) no colisionan por azar
// — "US" NO casa con "Australia", ni "Mali" con "Somalia". Normalizamos
// el alias resuelto in situ (sin tocar resolveAlias, cuyo valor crudo lo
// usan otros consumidores) para que "PSG" case con "Paris Saint-Germain".
export function nameMatch(a: string, b: string): boolean {
  const ta = normalize(resolveAlias(a)).split(' ').filter(Boolean)
  const tb = normalize(resolveAlias(b)).split(' ').filter(Boolean)
  if (ta.length === 0 || tb.length === 0) return false
  // Igualdad (misma longitud) o contención de una secuencia contigua de
  // palabras completas de una dentro de la otra.
  return tokenRunContains(ta, tb) || tokenRunContains(tb, ta)
}

/** ¿Aparecen TODAS las palabras de `inner`, en orden y contiguas, dentro
 *  de `outer`? Con misma longitud equivale a igualdad. Comparar por
 *  palabra completa (no subcadena) elimina los falsos positivos de
 *  nombres cortos preservando los sufijos/prefijos legítimos. */
function tokenRunContains(outer: string[], inner: string[]): boolean {
  if (inner.length === 0 || inner.length > outer.length) return false
  for (let i = 0; i + inner.length <= outer.length; i++) {
    let ok = true
    for (let j = 0; j < inner.length; j++) {
      if (outer[i + j] !== inner[j]) { ok = false; break }
    }
    if (ok) return true
  }
  return false
}

// ── Validación de pick contra resultado ──────────────────────────
export function isCorrect(pick: Pick, outcome: Outcome): boolean {
  if (pick === outcome) return true
  if (pick === '1X') return outcome === '1' || outcome === 'X'
  if (pick === 'X2') return outcome === 'X' || outcome === '2'
  return false
}

// ── Sistema de puntuación (PUNTOS FIJOS, sin apuestas) ─────────────
//   · +TENDENCY por tendencia (1·X·2) acertada.
//   · +PLENO_BONUS si se aciertan TODOS los picks jugables (pleno).
//   · +EXACT_BONUS si además se clava el marcador exacto (máx 3/jornada).
//   · Partido featured: los puntos de ese pick se duplican (x2) al acertar.
//   · Partido anulado: no compite (ni acierto ni fallo).
// Los puntos alimentan la Liga Taka (award_points) y el ranking de ligas
// privadas. NO hay monedas, stake ni cuotas en el scoring.
export const SCORING = {
  TENDENCY: 1,
  PLENO_BONUS: 5,
  /** Bonus por acertar el marcador EXACTO (además de la tendencia). Si el
   *  partido es featured, también se duplica. NO suma al pleno. */
  EXACT_BONUS: 3,
  /** Máximo nº de picks con exactScore por jornada. Server-side. */
  MAX_EXACT_PER_JORNADA: 3,
} as const

export interface PickScore {
  hit: boolean         // tendencia correcta (false si cancelled)
  cancelled: boolean   // true = partido anulado: no compite (ni acierto ni fallo)
  points: number       // puntos — 0 o TENDENCY (+EXACT_BONUS si exact, x2 si featured)
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
  /** true cuando el user acertó el partido featured y por tanto recibió
   *  el bonus x2. Solo uno por jornada como máximo. */
  featuredHit?: boolean
  /** Nº de picks con marcador exacto acertado (tendencia correcta Y
   *  goles exactos). 0..MAX_EXACT_PER_JORNADA. */
  exactHits?: number
}

export interface ScoreOptions {
  /** AD — Si false, el bonus de marcador exacto NO se suma a `points`
   *  (sí a `coins`, que es el wallet personal). Sirve para que el
   *  ranking de una liga con `exact_enabled=false` ignore este bonus
   *  sin afectar al wallet del user. Default: true. */
  countExactInPoints?: boolean
}

export function scorePick(
  pick: SavedPick,
  result: MatchResult | undefined,
  opts?: ScoreOptions,
): PickScore {
  if (!result) return { hit: false, cancelled: false, points: 0 }

  // Partido anulado: el pick no compite (ni acierto ni fallo).
  if (result.cancelled) return { hit: false, cancelled: true, points: 0 }

  const hit = isCorrect(pick.pick, result.outcome)

  // Puntos: tendencia binaria.
  let points = hit ? SCORING.TENDENCY : 0

  // E1 — Bonus por marcador exacto. Solo si: tendencia correcta (hit) +
  // user predijo exacto + los goles coinciden bit a bit. Se suma ANTES del
  // x2 featured para que el featured también doble el bonus.
  const exactBonus = !!(
    hit &&
    pick.exactScore &&
    Number.isFinite(pick.exactScore.home) &&
    Number.isFinite(pick.exactScore.away) &&
    pick.exactScore.home === result.homeGoals &&
    pick.exactScore.away === result.awayGoals
  )
  // El flag countExactInPoints permite a ligas con exact_enabled=false
  // ignorar el bonus en el ranking. exactBonus (la marca) se conserva igual.
  if (exactBonus && opts?.countExactInPoints !== false) points += SCORING.EXACT_BONUS

  // T — Bonus x2 sobre los puntos si el partido era featured y se acertó.
  // No hay penalty por fallar el featured: solo el upside está duplicado.
  const featuredBonus = hit && result.featured === true
  if (featuredBonus) points *= 2

  return { hit, cancelled: false, points, featuredBonus, exactBonus }
}

export function scorePicks(
  picks: SavedPick[],
  results: MatchResult[],
  opts?: ScoreOptions,
): ScoreBreakdown {
  const perPick = picks.map(p => {
    const r = results.find(rr => nameMatch(rr.home, p.home) && nameMatch(rr.away, p.away))
    return scorePick(p, r, opts)
  })
  const hits = perPick.filter(s => s.hit).length
  // Pleno se calcula sobre picks NO cancelados — anulado ≠ fallo.
  // Ejemplo: 6 picks, 1 cancelado, 5 aciertos → pleno (5 de 5 jugados).
  const cancelledCount = perPick.filter(s => s.cancelled).length
  const playable = picks.length - cancelledCount
  const pleno = playable > 0 && hits === playable
  let totalPoints = perPick.reduce((a, s) => a + s.points, 0)
  if (pleno) totalPoints += SCORING.PLENO_BONUS
  const featuredHit = perPick.some(s => s.featuredBonus === true)
  const exactHits = perPick.filter(s => s.exactBonus === true).length
  return { perPick, hits, pleno, totalPoints, featuredHit, exactHits }
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
