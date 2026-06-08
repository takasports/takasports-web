// ─────────────────────────────────────────────────────────────────
// Tarifa de monedas por juego (Ranked).
//
// Se calcula en el server tras un record_game_play exitoso, y se
// envía como p_amount al RPC award_game_coins (que tiene cap diario
// y idempotencia por (user, game, period)). Mantener esto en TS y
// no en SQL nos deja iterar/tunear sin migración.
//
// Empezamos solo con CrackQuiz para validar el patrón end-to-end.
// Cuando funcione limpio en prod, expandimos a los otros juegos
// añadiéndolos a COINS_ENABLED_GAMES + su rama en coinAmountFor().
// ─────────────────────────────────────────────────────────────────

export type GameId = 'quiniela' | 'crackquiz' | 'mionce' | 'sopacracks' | 'takagrid' | 'strikerrush'

// Whitelist. Quiniela tiene su propio camino (api/quiniela/score),
// así que no entra aquí — su balance se sigue acreditando directo via add_coins.
export const COINS_ENABLED_GAMES: ReadonlySet<GameId> = new Set<GameId>([
  'crackquiz',
  'mionce',
  'sopacracks',
])

/**
 * Tarifa por juego. Devuelve int >= 0; el RPC se encarga de truncar
 * por el cap diario. Mantener tarifas conservadoras al principio:
 * el grueso de la economía es quiniela, los juegos diarios son
 * el «daily login bonus».
 *
 * @param payload  Payload completo del play (mismo que se envía a record_game_play).
 *                 Permite tarifas basadas en aciertos / combo, no solo score.
 */
export function coinAmountFor(
  gameId: GameId,
  score: number,
  payload?: Record<string, unknown>,
): number {
  if (!COINS_ENABLED_GAMES.has(gameId)) return 0
  if (!Number.isFinite(score) || score < 0) return 0

  if (gameId === 'crackquiz') {
    // CrackQuiz: ronda diaria de 10 preguntas. Score máx típico ~150.
    //   · base    = 5  (recompensa solo por participar)
    //   · perf    = floor(score / 10)   → 0 a ~15
    //   · combo   = +5 si combo ≥ 5      → premia constancia, no suerte
    //   · perfecto = +10 si correct === total → bonus por 10/10
    // Total típico: 8–25 monedas por partida.
    const base = 5
    const perf = Math.floor(Math.max(0, score) / 10)
    const combo = Number(payload?.combo ?? 0) >= 5 ? 5 : 0
    const total = Number(payload?.total ?? 0)
    const correct = Number(payload?.correct ?? 0)
    const perfecto = total > 0 && correct === total ? 10 : 0
    return base + perf + combo + perfecto
  }

  if (gameId === 'mionce') {
    // Mi Once: reto SEMANAL — armar un 11 en una formación con reglas.
    // Tras el rework M1 todo tablero es tagged: el cliente manda
    // score = válidos × 10 (0–110, mismo valor que va a record_game_play).
    // Aquí lo normalizamos a válidos (0–11) para la tarifa: sin esto,
    // perf saturaba con 2 jugadores (min(11,score) con score≥11) y
    // "perfecto" saltaba sin el 11/11 real.
    //   · base       = 10  (entrar y dejar el lineup armado)
    //   · perf       = válidos * 2  → 0–22
    //   · perfecto   = +15 si válidos === 11 (lineup completo válido)
    // Total: 10–47 puntos/semana. (No toca el score 0–110 del ranking.)
    const valid = Math.max(0, Math.min(11, Math.round(score / 10)))
    const base = 10
    const perf = valid * 2
    const perfecto = valid >= 11 ? 15 : 0
    return base + perf + perfecto
  }

  if (gameId === 'sopacracks') {
    // Sopa de Cracks: SEMANAL. Score = palabras encontradas × 10 (0–~100).
    //   · base       = 10
    //   · perf       = floor(score / 10)   → 0–10
    //   · intruder   = +10 si encontró al jugador intruso del puzzle
    //   · timeAttack = +5 modo contrarreloj (más difícil)
    // Total típico: 10–35 monedas/semana.
    const base = 10
    const perf = Math.floor(Math.max(0, score) / 10)
    const intruder = payload?.intruder === true ? 10 : 0
    const timeAttack = payload?.timeAttack === true ? 5 : 0
    return base + perf + intruder + timeAttack
  }

  return 0
}
