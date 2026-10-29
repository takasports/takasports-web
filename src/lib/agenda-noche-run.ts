// ─────────────────────────────────────────────────────────────────
// Aviso de cada noche — orquestación (base de datos + calendario + envío).
//
// La lógica de cuándo y qué vive en lib/agenda-noche (pura, con pruebas).
// Aquí: navegadores suscritos al tema `agenda` → a quién le tocan ya sus
// 22:00 → partidos de su «mañana» (los mismos que pinta la página de día) →
// envío por Web Push → se apunta el día avisado en la propia suscripción.
//
// Casi todas las pasadas no hacen nada: si a nadie le tocan las 22:00 no se
// carga ni un partido.
// ─────────────────────────────────────────────────────────────────

import webpush from 'web-push'
import { adminSupabase } from './supabase-admin'
import { initVapid } from './push-helper'
import { loadDay } from './calendar-day-data'
import { getBroadcastForTz } from './broadcasts'
import { getEventHighlightScore } from './competitions'
import { partesEnZona, zonaValida } from './avisos-equipo'
import { addDays } from './calendar-day-page'
import { AGENDA_TOPIC, construirAviso, diaQueToca, diasFuente, type AvisoAgenda } from './agenda-noche'
import type { SportEvent } from './types'

interface Suscripcion {
  endpoint: string
  p256dh: string
  auth: string
  timezone: string | null
  agenda_sent_for: string | null
}

export interface InformeAgenda {
  enviado: boolean
  ahora: string
  suscritos: number
  lesToca: number
  avisos: Array<{ zona: string; dia: string; texto: AvisoAgenda | null; envios: number }>
  web: { sent: number; pruned: number; failed: number }
  aviso?: string
}

const score = (e: SportEvent) =>
  getEventHighlightScore({ comp: e.comp, home: e.home, away: e.away, stage: e.stage, isoDate: e.isoDate })

export async function enviarAgendaNoche(opts: {
  enviar: boolean
  ahora?: Date
  /** Vista previa: calcula el aviso de esta zona aunque nadie de ella esté suscrito. */
  zonaPrevia?: string
}): Promise<InformeAgenda> {
  const ahora = opts.ahora ?? new Date()
  const informe: InformeAgenda = {
    enviado: opts.enviar, ahora: ahora.toISOString(), suscritos: 0, lesToca: 0, avisos: [],
    web: { sent: 0, pruned: 0, failed: 0 },
  }
  const admin = adminSupabase()
  if (!admin) return { ...informe, aviso: 'sin supabase' }
  if (opts.enviar && !initVapid()) return { ...informe, aviso: 'sin claves VAPID' }

  const { data, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, timezone, agenda_sent_for')
    .contains('topics', [AGENDA_TOPIC])
  if (error) return { ...informe, aviso: `consulta: ${error.message}` }
  const subs = (data ?? []) as Suscripcion[]
  informe.suscritos = subs.length

  // Agrupados por zona y día: el texto es el mismo para todos los de la misma
  // zona, y así cada día del calendario se carga una sola vez por pasada.
  const grupos = new Map<string, { zona: string; dia: string; subs: Suscripcion[] }>()
  for (const s of subs) {
    const dia = diaQueToca(ahora, s.timezone, s.agenda_sent_for)
    if (!dia) continue
    const zona = zonaValida(s.timezone)
    const k = `${zona}|${dia}`
    if (!grupos.has(k)) grupos.set(k, { zona, dia, subs: [] })
    grupos.get(k)!.subs.push(s)
    informe.lesToca += 1
  }
  if (opts.zonaPrevia && !opts.enviar) {
    const zona = zonaValida(opts.zonaPrevia)
    const dia = addDays(partesEnZona(ahora, zona).dia, 1)
    if (!grupos.has(`${zona}|${dia}`)) grupos.set(`${zona}|${dia}`, { zona, dia, subs: [] })
  }
  if (grupos.size === 0) return informe

  const dias = new Map<string, Promise<SportEvent[]>>()
  const cargar = (d: string) => {
    if (!dias.has(d)) dias.set(d, loadDay(d).catch(() => []))
    return dias.get(d)!
  }

  const muertos: string[] = []
  for (const { zona, dia, subs: delGrupo } of grupos.values()) {
    const events = (await Promise.all(diasFuente(dia, zona).map(cargar))).flat()
    const texto = construirAviso(events, dia, zona, score, (e) => getBroadcastForTz(e.comp ?? '', e.sport ?? '', zona) ?? e.broadcast)
    const fila = { zona, dia, texto, envios: 0 }
    informe.avisos.push(fila)
    if (!opts.enviar) continue

    const payload = texto ? JSON.stringify({ ...texto, tag: AGENDA_TOPIC }) : null
    const avisados: string[] = []
    await Promise.allSettled(delGrupo.map(async (s) => {
      // Sin nada destacado mañana no se envía, pero el día se da por atendido:
      // si no, la pasada de las 22:xx de la hora siguiente volvería a mirarlo.
      if (!payload) { avisados.push(s.endpoint); return }
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as webpush.PushSubscription,
          payload,
        )
        informe.web.sent += 1
        fila.envios += 1
        avisados.push(s.endpoint)
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) muertos.push(s.endpoint)
        else informe.web.failed += 1
      }
    }))
    if (avisados.length > 0) {
      await admin.from('push_subscriptions').update({ agenda_sent_for: dia }).in('endpoint', avisados)
    }
  }
  if (muertos.length > 0) {
    informe.web.pruned = muertos.length
    try { await admin.from('push_subscriptions').delete().in('endpoint', muertos) } catch { /* swallow */ }
  }
  return informe
}
