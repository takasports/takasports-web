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

  return 0
}
