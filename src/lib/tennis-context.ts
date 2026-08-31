// Contexto de un partido de tenis: cómo llega cada jugador y qué nota tiene.
//
// Por qué existe: la ficha de un partido de tenis por jugarse enseñaba SEIS datos
// —torneo, ronda, dos nombres, dos banderas y la sede— y se acababa. El resto de
// la pantalla, negro. La API de ESPN no da nada más hasta que se juega el partido.
//
// Lo que sí tenemos, gratis y ya en Supabase:
//   · `past_events`  — 623 partidos de tenis desde mayo de 2026. Los 330 tenistas
//     del histórico tienen al menos uno, así que la forma reciente NUNCA sale
//     vacía; el 56% tiene tres o más.
//   · `ranking_entries` — la nota del Índice Taka. Cubre 132 de esos 330 (40%),
//     así que este bloque se cae con elegancia: si solo la tiene uno, se enseña
//     la suya sin comparar; si no la tiene ninguno, no se pinta.
//
// Lo que NO hacemos, y es deliberado: el cara a cara. Es lo primero que pediría
// cualquiera para una ficha de tenis y es justo lo insostenible — de los 613
// emparejamientos del histórico, solo 10 se han cruzado dos veces (1,6%). Puesto
// en la ficha estaría vacío en 98 de cada 100 partidos: cambiaríamos un hueco por
// otro, y encima con el título prometiendo algo. Se reabre cuando el histórico
// tenga un par de temporadas. [José Tomás, 31/08/2026]

import { adminSupabase } from '@/lib/supabase-admin'

/** Un partido anterior, contado desde el punto de vista del jugador. */
export interface TennisFormMatch {
  isoDate: string
  comp: string
  rival: string
  /** ¿Lo ganó ÉL? `null` si el marcador archivado no lo deja claro. */
  won: boolean | null
  /** Sets desde su lado: "2-0" es que ganó 2-0. Vacío si no hay marcador. */
  sets: string
  /** Para enlazar a la ficha de ese partido, si la hay. */
  matchRef?: string
}

export interface TennisPlayerContext {
  form: TennisFormMatch[]
  /** Nota del Índice Taka (0–100). Ausente si no está rankeado. */
  taka?: number
  /** Id de la entry, para enlazar a /rankings/<id>. */
  takaId?: string
}

export interface TennisContext {
  home: TennisPlayerContext
  away: TennisPlayerContext
}

/** Cuántos partidos anteriores se traen por jugador. */
const LIMITE_FORMA = 5

/**
 * Filas candidatas que se piden a la base. Se pide de más a propósito: la consulta
 * trae los partidos de LOS DOS jugadores mezclados y luego se reparten en memoria,
 * así que con el límite justo el que jugó menos se quedaría sin los suyos.
 */
const LIMITE_CONSULTA = 60

const norm = (s: string) => s.trim().toLowerCase()

interface FilaPasada {
  iso_date: string
  comp: string | null
  home: string | null
  away: string | null
  home_score: number | null
  away_score: number | null
  match_ref: string | null
}

/** Convierte una fila del histórico al punto de vista de `jugador`. */
function desdeElLado(fila: FilaPasada, jugador: string): TennisFormMatch | null {
  const esLocal = norm(fila.home ?? '') === norm(jugador)
  const rival = esLocal ? fila.away : fila.home
  if (!rival) return null

  const suyo = esLocal ? fila.home_score : fila.away_score
  const otro = esLocal ? fila.away_score : fila.home_score
  const conMarcador = suyo != null && otro != null

  return {
    isoDate: fila.iso_date,
    comp: fila.comp ?? '',
    rival,
    // Empate no existe en tenis, pero un marcador archivado a medias sí: en ese
    // caso `null` deja que la UI pinte el partido sin pastilla de V/D en vez de
    // inventarse una derrota.
    won: conMarcador ? (suyo! > otro! ? true : suyo! < otro! ? false : null) : null,
    sets: conMarcador ? `${suyo}-${otro}` : '',
    ...(fila.match_ref ? { matchRef: fila.match_ref } : {}),
  }
}

/**
 * Reúne forma reciente y nota de los dos jugadores. Nunca lanza: si la base no
 * responde, la ficha se queda como estaba (con su hueco) en vez de romperse.
 */
export async function getTennisContext(
  homePlayer: string | undefined,
  awayPlayer: string | undefined,
): Promise<TennisContext | null> {
  if (!homePlayer || !awayPlayer) return null
  const db = adminSupabase()
  if (!db) return null

  const nombres = [homePlayer, awayPlayer]

  try {
    // Dos consultas (local / visitante) en vez de un `.or()`: la sintaxis de
    // filtros de PostgREST separa por comas y por puntos, y los nombres de
    // tenistas llevan las dos cosas ("J. Maleckova"). Pasando los nombres por
    // `.in()` es el cliente quien los escapa, y no hay nada que citar a mano.
    const columnas = 'iso_date, comp, home, away, home_score, away_score, match_ref'
    const delLado = (col: 'home' | 'away') =>
      db.from('past_events')
        .select(columnas)
        .eq('sport', 'Tenis')
        .in(col, nombres)
        .order('iso_date', { ascending: false })
        .limit(LIMITE_CONSULTA)

    const [comoLocal, comoVisitante, notas] = await Promise.all([
      delLado('home'),
      delLado('away'),
      db.from('ranking_entries')
        .select('id, name, score_auto, score_manual')
        .eq('sport', 'tenis')
        .eq('active', true)
        .in('name', nombres),
    ])

    // Deduplicar ANTES de repartir. Cuando los dos jugadores de la ficha ya se
    // enfrentaron, esa fila sale en LAS DOS consultas (uno era local, el otro
    // visitante) y sin esto aparecía dos veces en la misma columna — visto en
    // Auger-Aliassime vs Tsitsipas, donde el partido anterior entre ellos salía
    // repetido y además falseaba la racha. [José Tomás, 31/08/2026]
    const vistas = new Set<string>()
    const filas = ([...(comoLocal.data ?? []), ...(comoVisitante.data ?? [])] as FilaPasada[])
      .filter(f => {
        const clave = f.match_ref ?? `${f.iso_date}|${f.home}|${f.away}`
        if (vistas.has(clave)) return false
        vistas.add(clave)
        return true
      })
      .sort((a, b) => (a.iso_date < b.iso_date ? 1 : a.iso_date > b.iso_date ? -1 : 0))

    // `ranking_entries` tiene PK compuesta (id, category): el mismo nombre puede
    // aparecer en varias categorías. Nos quedamos con la nota más alta de cada uno.
    const porNombre = new Map<string, { id: string; nota: number }>()
    for (const r of (notas.data ?? []) as { id: string; name: string; score_auto: number | string | null; score_manual: number | string | null }[]) {
      const nota = Number(r.score_manual ?? r.score_auto)
      if (!Number.isFinite(nota)) continue
      const clave = norm(r.name)
      const previo = porNombre.get(clave)
      if (!previo || nota > previo.nota) porNombre.set(clave, { id: r.id, nota })
    }

    const contextoDe = (jugador: string): TennisPlayerContext => {
      const form = filas
        .filter(f => norm(f.home ?? '') === norm(jugador) || norm(f.away ?? '') === norm(jugador))
        .map(f => desdeElLado(f, jugador))
        .filter((m): m is TennisFormMatch => m !== null)
        .slice(0, LIMITE_FORMA)
      const nota = porNombre.get(norm(jugador))
      return { form, ...(nota ? { taka: nota.nota, takaId: nota.id } : {}) }
    }

    const ctx: TennisContext = { home: contextoDe(homePlayer), away: contextoDe(awayPlayer) }

    // Sin nada que enseñar por ningún lado, mejor devolver null que un bloque
    // vacío: un título prometiendo contenido sobre un hueco es peor que el hueco.
    const vacio = !ctx.home.form.length && !ctx.away.form.length
      && ctx.home.taka == null && ctx.away.taka == null
    return vacio ? null : ctx
  } catch {
    return null
  }
}
