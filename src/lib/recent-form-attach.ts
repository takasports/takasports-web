// ── Forma reciente en la fila del calendario ────────────────────────────────
//
// Adjunta `homeForm` / `awayForm` (las últimas 5 barritas W/D/L) a los eventos.
// Lo llama /api/events/feed, que es de donde bebe la APP: hasta ahora la web
// pintaba las barritas —las calcula su SSR desde 2026-07— y la app no, porque
// el dato nunca salía por la API. Mismo criterio que el SSR del calendario, así
// que las dos plataformas enseñan lo mismo sin duplicar la consulta.
//
// UNA sola consulta por género: fetchRecentFormByTeams agrupa por nombre de
// equipo y está cacheada (unstable_cache). El corte por género es necesario
// porque clubes y selecciones comparten nombre con su homónimo masculino
// ("Real Madrid", "Barcelona", "España") y sin él se cruzaría la forma.

import type { SportEvent, FormResult } from './types'
import { fetchRecentFormByTeams } from './past-events'
import { WOMENS_COMPS } from './football-leagues'

/** Tope de la consulta agrupada: fetchRecentFormByTeams ya recorta a 200. */
const MAX_EQUIPOS = 200

export async function attachRecentForm(events: SportEvent[]): Promise<void> {
  const femeninos = new Set<string>()
  const resto = new Set<string>()
  for (const e of events) {
    const destino = WOMENS_COMPS.has(e.comp ?? '') ? femeninos : resto
    if (e.home) destino.add(e.home)
    if (e.away) destino.add(e.away)
  }
  if (femeninos.size === 0 && resto.size === 0) return

  const vacio: Record<string, FormResult[]> = {}
  const [formaF, formaM] = await Promise.all([
    femeninos.size
      ? fetchRecentFormByTeams([...femeninos].slice(0, MAX_EQUIPOS), 5, 'soccer/esp.w.1')
      : Promise.resolve<Record<string, FormResult[]> | null>(vacio),
    resto.size
      ? fetchRecentFormByTeams([...resto].slice(0, MAX_EQUIPOS), 5, 'soccer/esp.1')
      : Promise.resolve<Record<string, FormResult[]> | null>(vacio),
  ])

  for (const e of events) {
    const mapa = (WOMENS_COMPS.has(e.comp ?? '') ? formaF : formaM) ?? vacio
    const casa = e.home ? mapa[e.home] : undefined
    const fuera = e.away ? mapa[e.away] : undefined
    // Solo se adjunta lo que tiene contenido: un array vacío en el JSON es peso
    // por nada, y el cliente ya trata "sin forma" como no pintar barritas.
    if (casa?.length) e.homeForm = casa.slice(0, 5)
    if (fuera?.length) e.awayForm = fuera.slice(0, 5)
  }
}
