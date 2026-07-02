// ─────────────────────────────────────────────────────────────────
// Tarifa de puntos por juego (Liga Taka).
//
// Se calcula en el server tras un record_game_play exitoso y se envía
// como p_amount al RPC award_game_points (idempotente por (user, game,
// period), mejor-marca-gana: solo suma el delta al mejorar). Mantener
// esto en TS y no en SQL nos deja iterar/tunear sin migración.
//
// ESCALA ACORDADA (dígitos bajos — los minijuegos son el «daily/weekly
// login bonus», el grueso de la Liga Taka son las Predicciones):
//   · CrackQuiz / TakaGrid  — diarios  —  jugar 1 → perfecto 5
//   · Mi Once / Sopa        — semanales — jugar 2 → perfecto 12
// El floor (solo jugar) se paga siempre; el techo se alcanza al 100%.
//
// OJO: el `score` (0–110/0–180…) va a record_game_play con su propio
// techo antifraude (migr. 062). Aquí razonamos en aciertos/ratio, NO
// en ese score, para que la tarifa no herede su escala.
// ─────────────────────────────────────────────────────────────────

export type GameId = 'quiniela' | 'crackquiz' | 'mionce' | 'sopacracks' | 'takagrid' | 'strikerrush'

// Whitelist de juegos que acreditan a la Liga Taka. Quiniela tiene su
// propio camino (api/quiniela/score → award_points con puntos fijos),
// así que no entra aquí.
export const POINTS_ENABLED_GAMES: ReadonlySet<GameId> = new Set<GameId>([
  'crackquiz',
  'takagrid',
  'mionce',
  'sopacracks',
])

// Dominios reales de cada minijuego. Se usan para ACOTAR el payload que
// manda el cliente ANTES de derivar los puntos: aunque un POST mienta
// (correct > total, total gigante, tipos raros, arrays inflados…), el
// ratio se calcula sobre valores dentro del dominio real y la tarifa
// nunca supera su techo. Defensa en profundidad — el score ya tiene tope
// por juego (migr. 062) y los puntos su cap 500/txn (migr. 065).
export const GAME_LIMITS = {
  crackquiz:  { questions: 10 }, // ronda diaria de 10 preguntas
  sopacracks: { words: 14 },     // hasta 14 palabras por sopa
  takagrid:   { cells: 9 },      // rejilla 3×3
  mionce:     { valid: 11 },     // jugadores válidos (score = válidos × 10)
} as const

/**
 * Lee un entero de un valor no fiable y lo acota a [min, max].
 * Cualquier cosa no numérica finita (undefined, NaN, ±Infinity, objetos,
 * strings no numéricas) cae a `min` — el borde SEGURO (nunca infla).
 */
function boundedInt(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

/**
 * Tarifa por juego. Devuelve un int bajo >= 0 (el RPC aplica idempotencia
 * y mejor-marca-gana). Diarios 1→5, semanales 2→12.
 *
 * El payload del cliente NO es de fiar: cada campo se valida y acota a su
 * dominio real (ver GAME_LIMITS) antes de convertirse en puntos, así un
 * parte manipulado nunca acredita de más.
 *
 * @param payload  Payload completo del play (mismo que se envía a record_game_play).
 *                 Permite tarifas basadas en aciertos/ratio, no solo score.
 */
export function pointsFor(
  gameId: GameId,
  score: number,
  payload?: Record<string, unknown>,
): number {
  if (!POINTS_ENABLED_GAMES.has(gameId)) return 0
  if (!Number.isFinite(score) || score < 0) return 0

  if (gameId === 'crackquiz') {
    // Diario · 1 → 5. base 1 (participar) + hasta +4 según aciertos.
    // payload: { correct, total } (ronda de 10). total ≤ 10 y correct ≤ total
    // → el ratio queda en [0,1] aunque el cliente mienta.
    const total = boundedInt(payload?.total, 0, GAME_LIMITS.crackquiz.questions)
    const correct = boundedInt(payload?.correct, 0, total)
    const ratio = total > 0 ? correct / total : 0
    return 1 + Math.round(ratio * 4)
  }

  if (gameId === 'takagrid') {
    // Diario · 1 → 5. base 1 + hasta +4 según celdas resueltas (0–9).
    // payload.solved = boolean[9] (row-major); fallback numérico o desde el
    // score (= solved × (hardMode ? 20 : 10)). Se acota a 0–9 en todo caso.
    const cells = GAME_LIMITS.takagrid.cells
    const raw = payload?.solved
    let solved: number
    if (Array.isArray(raw)) solved = raw.filter(Boolean).length
    else if (typeof raw === 'number' && Number.isFinite(raw)) solved = raw
    else solved = Math.round(score / (payload?.hardMode ? 20 : 10))
    solved = boundedInt(solved, 0, cells)
    return 1 + Math.round((solved / cells) * 4)
  }

  if (gameId === 'mionce') {
    // Semanal · 2 → 12. base 2 + hasta +10 según válidos (0–11). SOLO score:
    // el cliente manda score = válidos × 10 (0–110); lo normalizamos y acotamos.
    const maxValid = GAME_LIMITS.mionce.valid
    const valid = Math.max(0, Math.min(maxValid, Math.round(score / 10)))
    return 2 + Math.round((valid / maxValid) * 10)
  }

  if (gameId === 'sopacracks') {
    // Semanal · 2 → 12. base 2 + hasta +10 según palabras encontradas.
    // payload: { found, total } (total ≤ 14, found ≤ total); fallback desde
    // el score (= found × 10).
    const words = GAME_LIMITS.sopacracks.words
    const total = boundedInt(payload?.total, 0, words)
    const found = boundedInt(payload?.found, 0, total)
    const ratio = total > 0
      ? found / total
      : clamp01(boundedInt(score / 10, 0, words) / 10)
    return 2 + Math.round(ratio * 10)
  }

  return 0
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}
