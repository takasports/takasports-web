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

/**
 * Tarifa por juego. Devuelve un int bajo >= 0 (el RPC aplica idempotencia
 * y mejor-marca-gana). Diarios 1→5, semanales 2→12.
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
    // payload: { correct, total } (ronda de 10 preguntas).
    const total = Number(payload?.total ?? 0)
    const correct = Number(payload?.correct ?? 0)
    const ratio = total > 0 ? clamp01(correct / total) : 0
    return 1 + Math.round(ratio * 4)
  }

  if (gameId === 'takagrid') {
    // Diario · 1 → 5. base 1 + hasta +4 según celdas resueltas (0–9).
    // payload.solved = boolean[9] (row-major); fallback desde el score
    // (= solved × (hardMode ? 20 : 10)).
    const raw = payload?.solved
    let solved: number
    if (Array.isArray(raw)) solved = raw.filter(Boolean).length
    else if (typeof raw === 'number' && Number.isFinite(raw)) solved = raw
    else solved = Math.round(score / (payload?.hardMode ? 20 : 10))
    solved = Math.max(0, Math.min(9, solved))
    return 1 + Math.round((solved / 9) * 4)
  }

  if (gameId === 'mionce') {
    // Semanal · 2 → 12. base 2 + hasta +10 según válidos (0–11).
    // El cliente manda score = válidos × 10 (0–110); lo normalizamos.
    const valid = Math.max(0, Math.min(11, Math.round(score / 10)))
    return 2 + Math.round((valid / 11) * 10)
  }

  if (gameId === 'sopacracks') {
    // Semanal · 2 → 12. base 2 + hasta +10 según palabras encontradas.
    // payload: { found, total }; fallback desde el score (= found × 10).
    const total = Number(payload?.total ?? 0)
    const found = Number(payload?.found ?? 0)
    const ratio = total > 0
      ? clamp01(found / total)
      : clamp01(Math.floor(Math.max(0, score) / 10) / 10)
    return 2 + Math.round(ratio * 10)
  }

  return 0
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}
