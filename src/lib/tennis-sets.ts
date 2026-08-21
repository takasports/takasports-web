// ── Marcador de tenis set a set ─────────────────────────────────────────────
//
// ESPN da el marcador de un tenista como UNA cadena con todos sus sets:
// "6-4 7-6(4) 3-2". De ahí salen las tres cosas que el producto necesita:
// cuántos sets lleva ganados, cómo va el set en curso y la línea completa.
//
// Vivía dentro de /api/events/live, que es donde se usaba. Se extrae aquí para
// poder testearlo y, sobre todo, para que la fila del calendario pueda pintar el
// set a set: hasta ahora el endpoint calculaba `setsStr` y el tipo del cliente
// lo dejaba caer, así que un tenis en directo se veía como "1 - 0" sin decir
// cómo iba ninguno de los sets.

/** Sets ganados por cada jugador a partir de la cadena del PRIMERO. */
export function parseSetsWon(scoreStr: string | undefined): [number, number] {
  if (!scoreStr) return [0, 0]
  const sets = scoreStr.trim().split(/\s+/)
  let home = 0, away = 0
  for (const set of sets) {
    const base = set.replace(/\(.*?\)/g, '')
    const [a, b] = base.split('-').map(Number)
    if (isNaN(a) || isNaN(b)) continue
    if (a > b) home++
    else if (b > a) away++
  }
  return [home, away]
}

/** ¿Está cerrado este set? Con tiebreak siempre; si no, 6+ juegos y 2 de ventaja. */
function isSetComplete(a: number, b: number, hasTiebreak: boolean): boolean {
  return hasTiebreak || ((a >= 6 || b >= 6) && Math.abs(a - b) >= 2)
}

/** Juegos del set EN CURSO ("3-2"), o null si no hay set abierto. */
export function parseCurrentSetScore(scoreStr: string | undefined): string | null {
  if (!scoreStr) return null
  const sets = scoreStr.trim().split(/\s+/)
  if (sets.length === 0) return null
  const raw = sets[sets.length - 1]
  const last = raw.replace(/\(.*?\)/g, '')
  const parts = last.split('-').map(Number)
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null
  const [a, b] = parts
  return isSetComplete(a, b, /\(.*?\)/.test(raw)) ? null : last
}

/**
 * Línea set a set lista para pintar: "6-4 7-5 *3-2".
 * El set en juego va marcado con `*` para que la UI pueda resaltarlo.
 */
export function formatTennisSets(homeStr: string | undefined): string {
  if (!homeStr) return ''
  const sets = homeStr.trim().split(/\s+/)
  const parts: string[] = []
  for (const set of sets) {
    const hasTiebreak = /\(.*?\)/.test(set)
    const base = set.replace(/\(.*?\)/g, '')
    const [a, b] = base.split('-').map(Number)
    if (isNaN(a) || isNaN(b)) continue
    parts.push(isSetComplete(a, b, hasTiebreak) ? `${a}-${b}` : `*${a}-${b}`)
  }
  return parts.join(' ')
}
