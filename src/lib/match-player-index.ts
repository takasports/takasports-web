// ── Nombre de jugador → id de ESPN, dentro de UN partido ────────────────────
//
// El minuto a minuto de ESPN nombra a los jugadores pero NO los identifica: sus
// `commentary[].play.participants[]` traen `athlete.displayName` y nada más.
// Comprobado el 21/08/2026 sobre Atlético-Málaga: 118 entradas, 95 con
// participantes, CERO ids.
//
// Las ALINEACIONES del mismo partido sí los traen (`rosters[].roster[].athlete.id`,
// Oblak → 149622). Como los dos vienen en la misma respuesta, el id se recupera
// cruzando por nombre — y así la crónica deja de ser texto muerto y cada jugador
// enlaza a su ficha.
//
// El cruce es conservador a propósito: si un nombre no está en las alineaciones
// (un suplente que no jugó, una grafía distinta), se queda sin enlace. Un enlace
// al jugador equivocado es peor que ningún enlace.

/** Quita acentos, signos y espacios para comparar nombres de forma estable. */
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export interface IndexedPlayer {
  id: string
  name: string
}

/**
 * Índice nombre normalizado → id. Además del nombre completo indexa el APELLIDO
 * (última palabra), porque la crónica suele abreviar: la alineación dice
 * "Julián Álvarez" y el minuto a minuto, "Álvarez".
 *
 * Un apellido que comparten dos jugadores del partido NO se indexa: ante la duda,
 * sin enlace.
 */
export function buildPlayerIndex(players: IndexedPlayer[]): Map<string, string> {
  const full = new Map<string, string>()
  const bySurname = new Map<string, string[]>()

  for (const p of players) {
    if (!p.id || !p.name) continue
    const key = normalizePlayerName(p.name)
    if (key) full.set(key, p.id)

    const words = p.name.trim().split(/\s+/)
    if (words.length > 1) {
      const surname = normalizePlayerName(words[words.length - 1])
      if (surname) {
        const list = bySurname.get(surname) ?? []
        if (!list.includes(p.id)) list.push(p.id)
        bySurname.set(surname, list)
      }
    }
  }

  // Los apellidos solo entran si son inequívocos dentro de ESTE partido, y nunca
  // pisan un nombre completo ya indexado.
  for (const [surname, ids] of bySurname) {
    if (ids.length === 1 && !full.has(surname)) full.set(surname, ids[0])
  }
  return full
}

/** Busca el id de un nombre suelto de la crónica. */
export function lookupPlayerId(index: Map<string, string>, name: string | undefined): string | undefined {
  if (!name) return undefined
  const key = normalizePlayerName(name)
  if (!key) return undefined
  if (index.has(key)) return index.get(key)

  // "Julián Álvarez" en la crónica contra "Álvarez" en el índice (o al revés).
  const words = name.trim().split(/\s+/)
  if (words.length > 1) {
    const surname = normalizePlayerName(words[words.length - 1])
    if (surname && index.has(surname)) return index.get(surname)
  }
  return undefined
}
