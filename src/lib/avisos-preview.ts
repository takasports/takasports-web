// ─────────────────────────────────────────────────────────────────
// Vista previa de los avisos push con datos REALES de hoy, para aprobar los
// textos antes de encenderlos. No envía nada ni escribe en ningún sitio.
//
// La usan /api/admin/avisos-preview (JSON o Markdown) y
// `npx tsx scripts/avisos-preview.ts` (Markdown por consola).
//
// Los ejemplos salen por los MISMOS caminos que el envío real: el feed de
// ESPN de /api/events/today, el `summary` de ESPN que lee el resultado, y los
// artículos de Sanity con el criterio de «importante» de lib/avisos-noticias.
// Lo único que se salta es la ventana horaria, para tener ejemplos a cualquier
// hora del día.
// ─────────────────────────────────────────────────────────────────

import { fetchEspnEvents } from './espn'
import { adminSupabase } from './supabase-admin'
import { sanityClient } from './sanity'
import { estadoPartido, calcularAvisosEquipo, type InformeEquipo } from './avisos-equipo-run'
import {
  cruzarPartidos, horaDecente, textoAvisoFinal, textoAvisoHoy, zonaValida, SIN_MADRUGADA_HOY,
  type AvisoTexto, type PartidoAviso,
} from './avisos-equipo'
import {
  articuloDesdePayload, esImportante, temaDeArticulo, textoAvisoNoticia,
  TOPE_POR_TEMA_DIA, UMBRAL_TAKA_SCORE,
} from './avisos-noticias'
import { ARTICULO_AVISO_GROQ } from './avisos-noticias-run'
import { madridDayISO } from './taka-time'
import { isWomensComp } from './football-leagues'

export interface EjemploAviso {
  tipo: 'equipo_hoy' | 'equipo_final' | 'noticia'
  contexto: string
  texto: AvisoTexto
}

export interface VistaPrevia {
  generado: string
  ejemplos: EjemploAviso[]
  /** Lo que haría AHORA el cron de equipo (simulación con los favoritos reales). */
  cronEquipoAhora: InformeEquipo | null
  /** Cuántos avisos de noticias habrían salido cada día con el criterio y el tope. */
  noticiasPorDia: Array<{ dia: string; tema: string; candidatas: number; avisadas: number }>
  notas: string[]
}

/** Equipos con tirón para buscar ejemplos si nadie con favoritos juega hoy. */
const EQUIPOS_MUESTRA = [
  'Real Madrid', 'Barcelona', 'Atlético Madrid', 'Real Betis', 'Sevilla', 'Athletic Club',
  'Manchester City', 'Liverpool', 'Arsenal', 'Bayern Munich', 'Inter Milan', 'PSG',
  'Boca Juniors', 'River Plate', 'Club América', 'España', 'Argentina', 'México',
  'Lakers', 'Celtics', 'Real Madrid Femenino',
]

export async function construirVistaPrevia(opts: { ahora?: Date; maxPorTipo?: number } = {}): Promise<VistaPrevia> {
  const ahora = opts.ahora ?? new Date()
  const max = opts.maxPorTipo ?? 5
  const notas: string[] = []
  const ejemplos: EjemploAviso[] = []

  // ── «Hoy juega tu…» con los partidos de hoy y mañana ─────────────────
  const eventos = (await fetchEspnEvents().catch(() => [])) as PartidoAviso[]
  const proximos = eventos.filter((e) => e.away && e.isoDate && !e.timeTbd
    && new Date(e.isoDate).getTime() > ahora.getTime()
    && new Date(e.isoDate).getTime() < ahora.getTime() + 36 * 3_600_000)
  const vistos = new Set<string>()
  const zonas = ['Europe/Madrid', 'Europe/Madrid', 'America/Mexico_City', 'Europe/Madrid', 'America/Argentina/Buenos_Aires']
  for (const equipo of EQUIPOS_MUESTRA) {
    if (ejemplos.filter((e) => e.tipo === 'equipo_hoy').length >= max) break
    const cruce = cruzarPartidos([equipo], proximos)[0]
    if (!cruce || vistos.has(cruce.partido.id)) continue
    const tz = zonas[(vistos.size + 1) % zonas.length]
    // Igual que el cron: un saque de madrugada en esa zona no tendría aviso.
    if (!horaDecente(new Date(cruce.partido.isoDate as string), tz, SIN_MADRUGADA_HOY)) continue
    vistos.add(cruce.partido.id)
    ejemplos.push({
      tipo: 'equipo_hoy',
      contexto: `Usuario que sigue «${equipo}», zona ${tz}. Saque ${cruce.partido.isoDate}.`,
      texto: textoAvisoHoy(cruce, zonaValida(tz), undefined, madridDayISO(ahora)),
    })
  }
  if (!ejemplos.some((e) => e.tipo === 'equipo_hoy')) notas.push('Ningún equipo de muestra juega en las próximas 36 h.')

  // ── «Resultado final» con partidos ya jugados (past_events + summary) ──
  const admin = adminSupabase()
  if (admin) {
    const { data: jugados } = await admin
      .from('past_events')
      .select('id, home, away, comp, sport, iso_date, match_ref, home_score, away_score')
      .not('away', 'is', null)
      .not('match_ref', 'is', null)
      .order('iso_date', { ascending: false })
      .limit(40)
    // Variedad: un local que gana, uno que pierde, un empate…
    const elegidos: typeof jugados = []
    const tipos = new Set<string>()
    for (const j of jugados ?? []) {
      if (elegidos.length >= max) break
      const k = j.home_score == null ? 'x' : j.home_score > j.away_score ? 'gana' : j.home_score < j.away_score ? 'pierde' : 'empate'
      if (tipos.has(k) && elegidos.length < 3) continue
      tipos.add(k)
      elegidos.push(j)
    }
    for (const j of elegidos) {
      const estado = await estadoPartido(j.match_ref as string)
      if (!estado) continue
      const partido: PartidoAviso = {
        id: j.id as string, home: j.home as string, away: j.away as string, comp: j.comp as string,
        sport: j.sport as string, isoDate: j.iso_date as string, matchRef: j.match_ref as string,
      }
      const cruce = { partido, equipo: partido.home, rival: partido.away as string, sigueAmbos: false, femenino: isWomensComp(partido.comp) }
      const texto = textoAvisoFinal(cruce, estado)
      if (texto) {
        ejemplos.push({ tipo: 'equipo_final', contexto: `Usuario que sigue «${partido.home}» (ESPN: ${estado.statusName}).`, texto })
      }
    }
  } else {
    notas.push('Sin Supabase: no hay ejemplos de resultado.')
  }

  // ── Noticias: artículos recientes con el criterio real ──────────────
  const desde = new Date(ahora.getTime() - 7 * 86_400_000).toISOString()
  const docs = await sanityClient
    .fetch<Record<string, unknown>[]>(
      `*[_type == "article" && !(_id in path('drafts.**')) && publishedAt > $desde] | order(publishedAt asc)${ARTICULO_AVISO_GROQ}`,
      { desde },
    )
    .catch(() => [] as Record<string, unknown>[])
  const articulos = docs
    .map((d) => articuloDesdePayload({ ...d, slug: { current: d.slug } }))
    .filter((a): a is NonNullable<typeof a> => !!a)

  // Simulación del tope: por día de Madrid y tema, los 2 primeros importantes
  // dentro de la franja horaria.
  const porDia = new Map<string, { dia: string; tema: string; candidatas: number; avisadas: number }>()
  const avisadas: typeof articulos = []
  for (const a of articulos) {
    const tema = temaDeArticulo(a)
    if (!tema || !a.publishedAt || !esImportante(a).ok) continue
    const pub = new Date(a.publishedAt)
    const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(pub)) % 24
    const clave = `${madridDayISO(pub)}|${tema}`
    const fila = porDia.get(clave) ?? { dia: madridDayISO(pub), tema, candidatas: 0, avisadas: 0 }
    fila.candidatas += 1
    if (hora >= 9 && hora < 23 && fila.avisadas < TOPE_POR_TEMA_DIA) {
      fila.avisadas += 1
      avisadas.push(a)
    }
    porDia.set(clave, fila)
  }
  for (const a of avisadas.slice(-max).reverse()) {
    ejemplos.push({
      tipo: 'noticia',
      contexto: `Tema ${temaDeArticulo(a)} · ${esImportante(a).por} · publicada ${a.publishedAt}`,
      texto: textoAvisoNoticia(a),
    })
  }
  notas.push(`Criterio de noticia: priority hero/destacado, breaking, o takaScore ≥ ${UMBRAL_TAKA_SCORE}; sin previas, columnas ni galerías; ≤ 3 h; 9-23 h Madrid; tope ${TOPE_POR_TEMA_DIA}/tema/día.`)

  const cronEquipoAhora = await calcularAvisosEquipo({ enviar: false, ahora, partidos: eventos }).catch(() => null)

  return {
    generado: ahora.toISOString(),
    ejemplos,
    cronEquipoAhora,
    noticiasPorDia: [...porDia.values()].sort((a, b) => (a.dia + a.tema).localeCompare(b.dia + b.tema)),
    notas,
  }
}

const NOMBRE_TIPO: Record<EjemploAviso['tipo'], string> = {
  equipo_hoy: '«Hoy juega tu equipo»',
  equipo_final: '«Resultado final»',
  noticia: 'Noticia importante',
}

export function vistaPreviaMarkdown(v: VistaPrevia): string {
  const l: string[] = [`# Avisos push · vista previa`, '', `Generado ${v.generado} con datos reales. Nada de esto se ha enviado.`, '']
  for (const tipo of ['equipo_hoy', 'equipo_final', 'noticia'] as const) {
    const ej = v.ejemplos.filter((e) => e.tipo === tipo)
    l.push(`## ${NOMBRE_TIPO[tipo]} (${ej.length})`, '')
    ej.forEach((e, i) => {
      l.push(`### ${i + 1}. ${e.texto.title}`, '', `- **Texto:** ${e.texto.body}`, `- **Al pulsar:** \`${e.texto.url}\``, `- _${e.contexto}_`, '')
    })
  }
  l.push('## Cuántos avisos de noticias habrían salido (últimos 7 días)', '', '| Día | Tema | Importantes | Avisadas |', '|---|---|---|---|')
  for (const f of v.noticiasPorDia) l.push(`| ${f.dia} | ${f.tema} | ${f.candidatas} | ${f.avisadas} |`)
  l.push('')
  if (v.cronEquipoAhora) {
    const c = v.cronEquipoAhora
    l.push('## El cron de equipo, ahora mismo (simulación)', '',
      `- Usuarios con algún equipo en favoritos: ${c.usuariosConEquipo} (con push: ${c.usuariosConPush})`,
      `- Partidos considerados: ${c.partidosConsiderados} · resultados consultados: ${c.resultadosConsultados}`,
      `- Avisos que saldrían ahora: ${c.avisos.length}`,
      `- Descartes: ${Object.entries(c.descartes).map(([k, n]) => `${k}=${n}`).join(', ') || 'ninguno'}`,
      ...(c.aviso ? [`- Aviso: ${c.aviso}`] : []), '')
  }
  if (v.notas.length) l.push('## Notas', '', ...v.notas.map((n) => `- ${n}`), '')
  return l.join('\n')
}
