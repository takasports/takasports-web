// ─────────────────────────────────────────────────────────────────
// Avisos de EQUIPO — orquestación (base de datos + ESPN + envío).
//
// La lógica de qué y cuándo vive en lib/avisos-equipo (pura, con pruebas).
// Aquí se junta: favoritos `team:*` → partidos de hoy (el mismo feed de ESPN
// que /api/events/today, con su caché de 5 min) → plan → envío.
//
// `enviar: false` (lo normal mientras AVISOS_EQUIPO_ENABLED no esté puesto)
// hace TODO menos escribir y enviar: lee el registro para no proponer lo ya
// avisado y devuelve la lista de avisos que saldrían, con su texto.
// ─────────────────────────────────────────────────────────────────

import { adminSupabase } from './supabase-admin'
import { fetchEspnEvents } from './espn'
import { parseMatchRef } from './match-ref'
import { sendPushToUser } from './push-helper'
import {
  cruzarPartidos, equiposPorUsuario, horaDecente, leerEstadoSummary, planAvisoHoy,
  textoAvisoFinal, tocaMirarResultado, zonaValida, SIN_MADRUGADA_FINAL,
  type AvisoTexto, type EstadoPartido, type PartidoAviso,
} from './avisos-equipo'

/** Tope de consultas `summary` a ESPN por pasada (son gratis, pero no infinitas). */
const MAX_SUMMARIES = 25
const LOG_PURGA_DIAS = 30

export interface AvisoPropuesto {
  /** Primeros 8 caracteres del id: suficiente para depurar, sin volcar ids enteros. */
  usuario: string
  tipo: 'equipo_hoy' | 'equipo_final'
  ref: string
  tz: string
  tienePush: boolean
  equipo: string
  partido: string
  saque?: string
  texto: AvisoTexto
  /** Solo con envío real. */
  resultado?: { reclamado: boolean; web?: number; app?: number; motivo?: string }
}

export interface InformeEquipo {
  enviado: boolean
  ahora: string
  usuariosConEquipo: number
  usuariosConPush: number
  partidosConsiderados: number
  resultadosConsultados: number
  descartes: Record<string, number>
  avisos: AvisoPropuesto[]
  aviso?: string
}

type Admin = NonNullable<ReturnType<typeof adminSupabase>>

export async function estadoPartido(matchRef: string): Promise<EstadoPartido | null> {
  const r = parseMatchRef(matchRef)
  if (!r) return null
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${r.leagueSlug}/summary?event=${r.eventId}`,
      { next: { revalidate: 120 }, signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return null
    return leerEstadoSummary(await res.json())
  } catch {
    return null
  }
}

export async function calcularAvisosEquipo(opts: {
  enviar: boolean
  ahora?: Date
  /** Inyectables para la vista previa y pruebas. */
  partidos?: PartidoAviso[]
}): Promise<InformeEquipo> {
  const ahora = opts.ahora ?? new Date()
  const informe: InformeEquipo = {
    enviado: opts.enviar, ahora: ahora.toISOString(),
    usuariosConEquipo: 0, usuariosConPush: 0, partidosConsiderados: 0, resultadosConsultados: 0,
    descartes: {}, avisos: [],
  }
  const descarta = (m: string) => { informe.descartes[m] = (informe.descartes[m] ?? 0) + 1 }

  const admin = adminSupabase()
  if (!admin) return { ...informe, aviso: 'supabase_no_configurado' }

  // 1) Favoritos de equipo (los escriben igual la web y la app).
  const { data: favs, error: favErr } = await admin
    .from('user_favorites')
    .select('user_id, entry_id')
    .like('entry_id', 'team:%')
  if (favErr) return { ...informe, aviso: `favoritos: ${favErr.message}` }
  const porUsuario = equiposPorUsuario(favs ?? [])
  informe.usuariosConEquipo = porUsuario.size
  if (porUsuario.size === 0) return informe
  const userIds = [...porUsuario.keys()]

  // 2) Zona horaria, destinos de push y lo ya avisado.
  const desdeLog = new Date(ahora.getTime() - 3 * 86_400_000).toISOString()
  const [perfiles, subs, tokens, log] = await Promise.all([
    admin.from('profiles').select('id, timezone').in('id', userIds),
    admin.from('push_subscriptions').select('user_id').in('user_id', userIds),
    admin.from('push_tokens').select('user_id').in('user_id', userIds),
    admin.from('avisos_equipo_log').select('user_id, kind, ref').in('user_id', userIds).gte('sent_at', desdeLog),
  ])
  const tzDe = new Map((perfiles.data ?? []).map((p) => [p.id as string, zonaValida(p.timezone as string | null)]))
  const conPush = new Set([...(subs.data ?? []), ...(tokens.data ?? [])].map((r) => r.user_id as string))
  informe.usuariosConPush = userIds.filter((u) => conPush.has(u)).length
  if (log.error) {
    // Sin la tabla (migración 136 sin aplicar) no hay idempotencia: se puede
    // calcular la vista previa, pero NUNCA enviar.
    if (opts.enviar) return { ...informe, aviso: `registro no disponible: ${log.error.message}` }
    informe.aviso = 'registro avisos_equipo_log no disponible (¿migración 136 sin aplicar?)'
  }
  const yaAvisado = new Set((log.data ?? []).map((r) => `${r.user_id}|${r.kind}|${r.ref}`))

  // 3) Partidos: de hace 7 h a dentro de 30 h, solo de equipos.
  const todos = opts.partidos ?? (await fetchEspnEvents().catch(() => [])) as PartidoAviso[]
  const minMs = ahora.getTime() - 7 * 3_600_000
  const maxMs = ahora.getTime() + 30 * 3_600_000
  const partidos = todos.filter((p) => {
    if (!p.away || !p.isoDate) return false
    const t = new Date(p.isoDate).getTime()
    return t >= minMs && t <= maxMs
  })
  informe.partidosConsiderados = partidos.length

  // 4) «Hoy juega tu…»
  const propuestos: Array<AvisoPropuesto & { userId: string }> = []
  for (const [userId, equipos] of porUsuario) {
    const tz = tzDe.get(userId) ?? zonaValida(null)
    const plan = planAvisoHoy({ equipos, partidos, tz, ahora })
    if (!plan.ok) { descarta(`hoy:${plan.motivo}`); continue }
    if (yaAvisado.has(`${userId}|equipo_hoy|${plan.ref}`)) { descarta('hoy:ya_avisado'); continue }
    propuestos.push({
      userId, usuario: userId.slice(0, 8), tipo: 'equipo_hoy', ref: plan.ref, tz,
      tienePush: conPush.has(userId), equipo: plan.cruce.equipo,
      partido: `${plan.cruce.partido.home} vs ${plan.cruce.partido.away}`,
      saque: plan.cruce.partido.isoDate, texto: plan.texto,
    })
  }

  // 5) «Resultado final»: solo los partidos que alguien sigue, y uno a uno
  //    (`summary`), porque el scoreboard por rango está muerto en ESPN para
  //    fútbol y NBA desde septiembre.
  const pendientes: Array<{ userId: string; tz: string; cruce: ReturnType<typeof cruzarPartidos>[number] }> = []
  for (const [userId, equipos] of porUsuario) {
    const tz = tzDe.get(userId) ?? zonaValida(null)
    for (const cruce of cruzarPartidos(equipos, partidos)) {
      if (!tocaMirarResultado(cruce.partido, ahora)) continue
      if (yaAvisado.has(`${userId}|equipo_final|${cruce.partido.id}`)) { descarta('final:ya_avisado'); continue }
      if (!horaDecente(ahora, tz, SIN_MADRUGADA_FINAL)) { descarta('final:madrugada'); continue }
      pendientes.push({ userId, tz, cruce })
    }
  }
  const refs = [...new Set(pendientes.map((p) => p.cruce.partido.matchRef as string))].slice(0, MAX_SUMMARIES)
  const estados = new Map<string, EstadoPartido | null>()
  await Promise.all(refs.map(async (ref) => { estados.set(ref, await estadoPartido(ref)) }))
  informe.resultadosConsultados = refs.length
  for (const { userId, tz, cruce } of pendientes) {
    const estado = estados.get(cruce.partido.matchRef as string)
    if (!estado) { descarta('final:sin_estado'); continue }
    if (!estado.final) { descarta('final:no_acabado'); continue }
    const texto = textoAvisoFinal(cruce, estado)
    if (!texto) { descarta('final:sin_marcador'); continue }
    propuestos.push({
      userId, usuario: userId.slice(0, 8), tipo: 'equipo_final', ref: cruce.partido.id, tz,
      tienePush: conPush.has(userId), equipo: cruce.equipo,
      partido: `${cruce.partido.home} vs ${cruce.partido.away}`, saque: cruce.partido.isoDate, texto,
    })
  }

  if (!opts.enviar) {
    informe.avisos = propuestos.map(({ userId: _u, ...resto }) => resto)
    return informe
  }

  // 6) Envío real: reclamar en el registro ANTES de enviar (at-most-once).
  await purgarRegistro(admin, ahora)
  for (const p of propuestos) {
    const { userId, ...publico } = p
    if (!p.tienePush) {
      informe.avisos.push({ ...publico, resultado: { reclamado: false, motivo: 'sin_push' } })
      continue
    }
    const { data: reclamado, error } = await admin
      .from('avisos_equipo_log')
      .upsert({ user_id: userId, kind: p.tipo, ref: p.ref }, { onConflict: 'user_id,kind,ref', ignoreDuplicates: true })
      .select('user_id')
    if (error || !reclamado || reclamado.length === 0) {
      informe.avisos.push({ ...publico, resultado: { reclamado: false, motivo: error ? 'error_registro' : 'ya_avisado' } })
      continue
    }
    const r = await sendPushToUser(userId, { ...p.texto, topic: null })
    informe.avisos.push({ ...publico, resultado: { reclamado: true, web: r.web.sent, app: r.app.sent, motivo: r.reason } })
  }
  return informe
}

async function purgarRegistro(admin: Admin, ahora: Date): Promise<void> {
  try {
    await admin
      .from('avisos_equipo_log')
      .delete()
      .lt('sent_at', new Date(ahora.getTime() - LOG_PURGA_DIAS * 86_400_000).toISOString())
  } catch { /* swallow */ }
}
