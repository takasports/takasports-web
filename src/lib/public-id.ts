import { createHash } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────
// Identificador público opaco: hash no-reversible (sha256 → 16 hex)
// del user_id de auth. Permite al cliente keyear/deduplicar/comparar
// una fila ("¿soy yo?") sin exponer el UUID de auth, que se usa en
// RLS/joins y NO debe salir en respuestas públicas o cacheadas.
//
// Fuente única: usado por /api/games/leaderboard y los leaderboards
// de Ranked (/api/ranked/leaderboard, /api/ranked/leagues/[id]). El
// mismo input produce siempre el mismo pid, así que el cliente puede
// comparar su propio pid (de /api/ranked/me o del payload de la liga)
// contra el de cada fila para marcar la suya.
// ─────────────────────────────────────────────────────────────────

export function publicId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16)
}
