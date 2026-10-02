// Módulo mínimo a propósito: lo importan la UI y la API de la votación, y
// rankings-ui arrastra los datos estáticos del ranking.

/**
 * Espectáculo con guion, no competición: la WWE (en la base va como `wwe` y,
 * en algunas fichas viejas, como `wrestling`). Tiene su pestaña propia, pero
 * NO entra en la lista «Todos» de deportistas ni en «¿A quién apoyas?»: el
 * 01/10/2026 Roman Reigns salía 5º, entre Sinner y Haaland. Decisión del
 * dueño (02/10/2026).
 */
export const DEPORTES_ESPECTACULO: readonly string[] = ['wwe', 'wrestling']

export function esCompeticion(sport: string | null | undefined): boolean {
  return !DEPORTES_ESPECTACULO.includes(sport ?? '')
}
