// ── "Por qué importa" este partido (Fase 2 del rediseño del calendario) ─────
//
// Deriva una etiqueta corta del CONTEXTO de tabla de los dos equipos. Sin IA y
// sin llamadas: solo mira los puestos/zonas que fetchEspnEvents ya adjuntó al
// evento (SportEvent.homeStanding / awayStanding).
//
// Sustituye a la única herramienta de jerarquía que había —el filtro
// "Destacados", que ESCONDE lo secundario— por una que REALZA lo importante.
//
// Regla de oro: si no hay un motivo claro, no se inventa nada (devuelve null).
// Una fila sin etiqueta es mejor que una etiqueta genérica en todas las filas.
//
// ESPEJO en takasports-shared/src/stakes/index.ts (lo consume la app). La web no
// usa el paquete compartido, así que ambos se mantienen a mano — misma convención
// que calendar-curate.ts. Los tests de esta lógica están aquí (match-stakes.test.ts).

import type { TeamStanding } from './types'

export interface MatchStakes {
  /** Texto corto en mayúsculas para la píldora. */
  label: string
  /** Peso visual: 'alta' = oro (cabeza/título), 'media' = ámbar tenue. */
  tone: 'alta' | 'media'
}

const CONTINENTAL: ReadonlySet<string> = new Set(['champions', 'europa', 'conference'])
const DROP: ReadonlySet<string> = new Set(['relegation', 'relegation_playoff'])

/** Ordinal español corto: 1 → "1º". */
function ord(n: number): string {
  return `${n}º`
}

/**
 * Motivo del partido a partir de la clasificación de ambos equipos.
 * Devuelve null si faltan datos o si el cruce no tiene nada especial.
 */
export function matchStakes(
  home: TeamStanding | undefined,
  away: TeamStanding | undefined,
): MatchStakes | null {
  if (!home || !away) return null
  const hi = Math.min(home.rank, away.rank)
  const lo = Math.max(home.rank, away.rank)

  // 1º vs 2º — el cartel máximo de cualquier liga.
  if (hi === 1 && lo === 2) return { label: 'Líder vs 2º', tone: 'alta' }

  // El líder recibe/visita a alguien del top 4 → sigue siendo duelo de cabeza.
  if (hi === 1 && lo <= 4) return { label: `Líder vs ${ord(lo)}`, tone: 'alta' }

  // Dos del top 4 sin el líder: pelea por Champions/título.
  if (lo <= 4) return { label: 'Duelo de cabeza', tone: 'alta' }

  // Ambos en zona continental (champions/europa/conference) → puestos europeos.
  if (home.zone && away.zone && CONTINENTAL.has(home.zone) && CONTINENTAL.has(away.zone)) {
    return { label: 'Puestos europeos', tone: 'media' }
  }

  // A partir de aquí, todo lo que queda habla de DESCENDER. En una liga cerrada
  // (NBA) quedar último no es descender, es entrar en el sorteo: la etiqueta
  // sería sencillamente falsa.
  const conDescenso = home.relegation !== false && away.relegation !== false
  if (!conDescenso) return null

  // Ambos en descenso (o playoff de descenso) → duelo directo abajo.
  if (home.zone && away.zone && DROP.has(home.zone) && DROP.has(away.zone)) {
    return { label: 'Duelo de descenso', tone: 'media' }
  }

  // Sin zonas definidas (ligas fuera de league-zones y sin nota de ESPN):
  // colista contra colista usando el tamaño de la tabla, si lo conocemos.
  const size = home.of ?? away.of
  if (size && size >= 10 && hi > size - 4) return { label: 'Duelo de descenso', tone: 'media' }

  return null
}

/**
 * Etiqueta compacta de posición para la fila: "4º · 38 pts", y en las ligas por
 * conferencias con balance en vez de puntos, "3º Este · 60-22".
 *
 * La NBA no se mide en puntos —su stat `points` de ESPN vale 19 y no significa
 * nada para el lector— sino en victorias-derrotas; y su puesto es de conferencia,
 * así que sin decirlo un "3º" se leería como tercero de la liga.
 */
export function standingLabel(s: TeamStanding | undefined): string | null {
  if (!s) return null
  const puesto = s.group ? `${ord(s.rank)} ${s.group}` : ord(s.rank)
  const valor = s.relegation === false && s.record ? s.record : `${s.pts} pts`
  return `${puesto} · ${valor}`
}
