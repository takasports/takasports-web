// ── La ficha de un tenista ──────────────────────────────────────────────────
//
// Desde que el calendario enlaza los nombres de tenis, la ficha se abre… y dice
// "Sin estadísticas disponibles". No es un fallo de datos: `/api/jugador` está
// hecho para fútbol (ESPN Core, estadísticas por temporada) y NBA (statsSummary),
// y para tenis ESPN devuelve 404 en `/stats` y un gamelog vacío.
//
// Lo que sí publica, gratis y en una sola llamada por tour, es la CLASIFICACIÓN
// (150 jugadores con puesto, puntos y puesto de la semana anterior). Y en tenis
// el ranking no es "una estadística más": es LA estadística — lo primero que
// alguien quiere saber de un jugador que no reconoce.
//
// El resto (mano, debut, temporadas) sale del propio overview del atleta, que ya
// se pedía y del que solo se leían edad y altura.

/** Entrada de la clasificación de un tour para un jugador concreto. */
export interface TennisRank {
  current: number
  previous?: number
  points?: number
  /** Bandera del país (CDN de ESPN) y su nombre, que el overview del atleta NO trae. */
  flag?: string
  flagAlt?: string
  headshot?: string
}

export interface TennisBio {
  /** 'RIGHT' | 'LEFT' según ESPN. */
  hand?: string
  debutYear?: number
  /** "10th Season" en el original. */
  experience?: string
}

export interface LabelledStat {
  label: string
  value: string
}

const asObj = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/**
 * Busca a un jugador en el JSON de clasificación de su tour.
 *
 * ESPN devuelve varias listas (`rankings[]`) y hay que recorrerlas todas: la de
 * individuales no siempre es la primera.
 */
export function findTennisRank(rankingsJson: unknown, athleteId: string): TennisRank | null {
  const listas = asArr(asObj(rankingsJson)?.rankings)
  for (const lista of listas) {
    for (const raw of asArr(asObj(lista)?.ranks)) {
      const e = asObj(raw)
      const a = asObj(e?.athlete)
      if (!e || !a || String(a.id ?? '') !== athleteId) continue
      const current = typeof e.current === 'number' ? e.current : NaN
      if (!Number.isFinite(current)) return null
      return {
        current,
        previous: typeof e.previous === 'number' ? e.previous : undefined,
        points: typeof e.points === 'number' ? e.points : undefined,
        flag: typeof a.flag === 'string' ? a.flag : undefined,
        flagAlt: typeof a.flagAltText === 'string' ? a.flagAltText : undefined,
        headshot: typeof a.headshot === 'string' ? a.headshot : undefined,
      }
    }
  }
  return null
}

/**
 * Separador de miles ESPAÑOL: 12345 → "12.345", pero 8316 → "8316".
 *
 * Lo de las cuatro cifras no es un descuido: en español no se agrupan (es lo
 * que dice CLDR y lo que hace `toLocaleString('es-ES')`). Se implementa a mano
 * en vez de delegar en Intl porque un runtime sin ICU completo cae a en-US y
 * pintaría "8,316" — coma decimal en español, que es justo lo contrario.
 */
function miles(n: number): string {
  const s = String(Math.round(n))
  return s.length > 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : s
}

/** "10th Season" → "10ª". Si no encaja, se devuelve tal cual. */
export function temporadaOrdinal(experience: string | undefined): string | undefined {
  if (!experience) return undefined
  const m = /^(\d+)/.exec(experience.trim())
  return m ? `${m[1]}ª` : undefined
}

/**
 * Tarjetas de la ficha. Devuelve [] si no hay NADA que contar — la página ya
 * sabe enseñar su estado vacío, y media tarjeta suelta se ve peor que ninguna.
 */
export function buildTennisStats(
  rank: TennisRank | null,
  bio: TennisBio,
  tour: string,
): LabelledStat[] {
  const out: LabelledStat[] = []
  if (rank) {
    out.push({ label: `Ranking ${tour}`, value: `Nº ${rank.current}` })
    if (rank.points != null) out.push({ label: 'Puntos', value: miles(rank.points) })
    // Solo si CAMBIÓ: repetir "2º / 2º" ocupa una tarjeta para no decir nada.
    if (rank.previous != null && rank.previous !== rank.current) {
      out.push({ label: 'Semana anterior', value: `Nº ${rank.previous}` })
    }
  }
  const mano = bio.hand === 'LEFT' ? 'Zurda' : bio.hand === 'RIGHT' ? 'Diestra' : undefined
  if (mano) out.push({ label: 'Mano', value: mano })
  if (bio.debutYear) out.push({ label: 'Debut', value: String(bio.debutYear) })
  const temporada = temporadaOrdinal(bio.experience)
  if (temporada) out.push({ label: 'Temporada', value: temporada })
  return out
}
