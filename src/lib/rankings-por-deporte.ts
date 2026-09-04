// ─────────────────────────────────────────────────────────────────────────────
// Agrupar el ranking "Todos" por deporte.
//
// Hasta el 04/09/2026 la vista "Todos" era una sola lista mezclada: el nº 1 del
// deporte salía siendo un luchador de la WWE por delante de Bellingham y de
// Sinner, porque sus notas —calculadas con fuentes distintas por deporte— se
// ordenaban juntas como si fueran comparables. Ahora se pinta un podio por
// deporte y la lista mezclada se conserva ENTERA debajo (decisión de José Tomás,
// 04/09/2026: ni se retira ni se muda a otra URL).
//
// Esta función es pura a propósito: el orden de los deportes depende de a quién
// sigue el usuario, que solo se sabe en el navegador, y quería poder probarlo
// sin montar el componente.
// ─────────────────────────────────────────────────────────────────────────────

export interface GrupoDeporte<T> {
  /** Slug canónico del deporte ('futbol', 'tenis'…). */
  sport: string
  /** Los `porGrupo` primeros de ese deporte, en el mismo orden que entraron. */
  entries: T[]
  /** Cuántos hay en total en ese deporte (para el «Ver los N →»). */
  total: number
  /** true si el usuario sigue este deporte → sube arriba y se marca. */
  seguido: boolean
}

/**
 * Reparte `entries` (YA ordenadas por nota, de mayor a menor) en un grupo por
 * deporte.
 *
 * El orden de los grupos: primero los deportes que sigue el usuario y luego el
 * resto, respetando dentro de cada mitad el orden de `ordenBase`. Un deporte que
 * aparece en los datos pero no en `ordenBase` (hoy la lucha libre en la pestaña
 * de deportistas) va al final de su mitad, nunca se pierde.
 *
 * Las entradas sin `sport` no forman grupo — siguen apareciendo en la lista
 * completa de abajo, que es la que no filtra nada.
 */
export function agruparPorDeporte<T extends { sport?: string }>(
  entries: T[],
  ordenBase: string[],
  seguidos: Iterable<string> = [],
  porGrupo = 3,
): GrupoDeporte<T>[] {
  const seguidosSet = new Set(seguidos)
  const porSport = new Map<string, T[]>()
  for (const e of entries) {
    const s = e.sport
    if (!s) continue
    const lista = porSport.get(s)
    if (lista) lista.push(e)
    else porSport.set(s, [e])
  }

  // Peso de orden: el de `ordenBase`; lo que no esté, detrás y por orden de
  // aparición en los datos (que ya viene por nota, así que es estable).
  const base = new Map(ordenBase.map((s, i) => [s, i]))
  const peso = (s: string) => base.get(s) ?? ordenBase.length + [...porSport.keys()].indexOf(s)

  return [...porSport.entries()]
    .map(([sport, lista]): GrupoDeporte<T> => ({
      sport,
      entries: lista.slice(0, porGrupo),
      total: lista.length,
      seguido: seguidosSet.has(sport),
    }))
    .sort((a, b) => {
      if (a.seguido !== b.seguido) return a.seguido ? -1 : 1
      return peso(a.sport) - peso(b.sport)
    })
}
