// ── El canal, una vez por liga y no en cada fila ────────────────────────────
//
// Medido el 21/08/2026 sobre el feed: de los 22 partidos del día, **16 llevaban
// el mismo canal que el resto de su liga**. «ESPN / STAR+» o «DAZN» se imprimía
// fila a fila, en gris, diciendo lo mismo cada vez.
//
// Cuando toda la liga comparte emisión, el dato sube a la cabecera del grupo y
// desaparece de las filas. Si la liga está repartida entre varios canales —que
// pasa— cada fila conserva el suyo, porque ahí sí distingue.
//
// Ojo con el caso tramposo: una liga con un solo partido "comparte" canal por
// definición, pero subirlo a la cabecera para una única fila no ahorra nada y
// deja la fila desnuda. Se exige más de un partido.

/** Canal común a TODO el grupo, o null si no lo hay (o si el grupo es de uno). */
export function groupChannel(events: readonly { broadcast?: string }[]): string | null {
  if (events.length < 2) return null
  const primero = events[0]?.broadcast
  if (!primero) return null
  for (const e of events) if (e.broadcast !== primero) return null
  return primero
}

/**
 * Canal que le toca pintar a UNA fila: ninguno si su liga ya lo anuncia arriba.
 */
export function rowChannel(
  broadcast: string | undefined,
  canalDelGrupo: string | null,
): string | undefined {
  if (!broadcast) return undefined
  return broadcast === canalDelGrupo ? undefined : broadcast
}
