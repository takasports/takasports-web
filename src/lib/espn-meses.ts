/**
 * El parámetro de RANGO del marcador de ESPN dejó de existir.
 *
 * Hasta el 18/09/2026 pedíamos `?dates=20260918-20261009` y ESPN devolvía todos
 * los partidos de esa ventana. Ese día la llamada empezó a responder **HTTP 400**
 * para fútbol y baloncesto. No para todos: MMA y motor siguen aceptándola, que es
 * justo por lo que el fallo fue tan difícil de ver —el calendario seguía
 * enseñando tenis, pádel, UFC y F1, y solo faltaban el fútbol y la NBA—.
 *
 * Y faltaban en silencio: los once sitios que pedían un rango envuelven la
 * llamada en `if (!res.ok) return []`, así que un 400 se convierte en «no hay
 * partidos» sin un solo error en los registros. El 18/09/2026, un viernes con
 * jornada completa en Europa, /calendario anunciaba «2 partidos» y eran dos
 * cuartos de un torneo de tenis.
 *
 * Lo que SÍ sigue funcionando, comprobado sobre la API en vivo:
 *
 *   ?dates=20260918              un día        200
 *   ?dates=20260918-20260919     dos días      400   ← cualquier rango, 400
 *   ?dates=202609                un mes        200   ← la vía que usamos ahora
 *   (sin dates)                  solo hoy      200
 *
 * Así que pedimos por MESES y recortamos nosotros a la ventana que queríamos.
 * Un mes natural es la unidad más grande que ESPN acepta, así que una ventana
 * normal son una o dos llamadas por competición en vez de una: es el precio de
 * que vuelva a haber fútbol.
 */

/** `2026-09-18` o `20260918` → `202609`. */
function mesDe(iso: string): string {
  const limpio = iso.replace(/-/g, '')
  return limpio.slice(0, 6)
}

/**
 * Los meses naturales que tocan una ventana, en orden.
 *
 * `mesesDeVentana('20260918', '20261009')` → `['202609', '202610']`
 */
export function mesesDeVentana(desde: string, hasta: string): string[] {
  const a = mesDe(desde)
  const b = mesDe(hasta)
  if (a > b) return mesesDeVentana(hasta, desde)

  const out: string[] = []
  let anio = Number(a.slice(0, 4))
  let mes = Number(a.slice(4, 6))
  // Tope de seguridad: una ventana disparatada no debe convertirse en cientos
  // de llamadas a ESPN. 24 meses cubre de sobra el caso más largo del sitio
  // (el archivo del Mundial) y corta cualquier fecha corrupta.
  for (let i = 0; i < 24; i++) {
    const clave = `${anio}${String(mes).padStart(2, '0')}`
    out.push(clave)
    if (clave === b) break
    mes++
    if (mes > 12) { mes = 1; anio++ }
  }
  return out
}

/** `Date` → `20260918`, en UTC, que es lo que entiende ESPN. */
export function claveDia(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/** Hoy y hoy±n, como claves `AAAAMMDD`. */
export function diaDesplazado(dias: number, desde: Date = new Date()): string {
  const d = new Date(desde)
  d.setUTCDate(d.getUTCDate() + dias)
  return claveDia(d)
}

type Evento = Record<string, unknown>

/**
 * Pide el marcador de una competición para una ventana de fechas y devuelve los
 * eventos, ya recortados a esa ventana y sin duplicados.
 *
 * Recorta porque un mes natural se sale por los dos lados de casi cualquier
 * ventana: pedir septiembre para ver los próximos veintiún días trae también el
 * uno de septiembre. Antes recortaba ESPN; ahora nos toca a nosotros, y hacerlo
 * aquí es lo que mantiene idéntico el comportamiento de quien llama.
 */
export async function eventosDeVentana<T = Record<string, unknown>>(opciones: {
  slug: string
  desde: string
  hasta: string
  limite?: number
  fetchOpciones?: RequestInit & { next?: { revalidate?: number } }
  timeoutMs?: number
}): Promise<T[]> {
  const { slug, desde, hasta, limite = 300, fetchOpciones, timeoutMs = 8000 } = opciones
  const meses = mesesDeVentana(desde, hasta)

  const respuestas = await Promise.allSettled(
    meses.map(async (mes) => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard?dates=${mes}&limit=${limite}`
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        ...fetchOpciones,
      })
      if (!res.ok) return [] as Evento[]
      const json = (await res.json()) as { events?: Evento[] }
      return json.events ?? []
    }),
  )

  const dentro = (ev: Evento): boolean => {
    const iso = typeof ev.date === 'string' ? ev.date : null
    if (!iso) return false
    const clave = iso.slice(0, 10).replace(/-/g, '')
    return clave >= desde.replace(/-/g, '') && clave <= hasta.replace(/-/g, '')
  }

  const vistos = new Set<string>()
  const out: Evento[] = []
  for (const r of respuestas) {
    if (r.status !== 'fulfilled') continue
    for (const ev of r.value) {
      if (!dentro(ev)) continue
      const id = typeof ev.id === 'string' ? ev.id : JSON.stringify(ev).slice(0, 80)
      if (vistos.has(id)) continue
      vistos.add(id)
      out.push(ev)
    }
  }
  out.sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
  return out as T[]
}
