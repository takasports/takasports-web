// Lo que pasa DESPUÉS de puntuar partidos de la Jornada de fútbol (cron
// sync-football): insignias de acierto y el aviso «Jornada: acertaste X de Y».
//
// Antes el cron puntuaba y ya: nadie recibía la insignia del primer acierto
// (solo la daba el endpoint manual admin/ranked/score) y nadie se enteraba de
// cómo le había ido la Jornada sin abrir la app.
//
// Todo aquí es BEST-EFFORT: el llamante lo envuelve en try/catch y además cada
// paso captura sus errores. Un fallo de insignias o de push nunca puede romper
// ni deshacer el puntuado, que ya está hecho cuando se llega aquí.

import type { SupabaseClient } from '@supabase/supabase-js'
import { awardBadges, badgesEarnedOnRankedCorrect } from './badge-awards'
import { processLevelProgression } from './level-progression'
import { sendPushToUser } from './push-helper'
import { RANKED_FOOTBALL_SPORT } from './football-ranked'

export interface PrediccionPuntuada {
  user_id: string
  event_id: string
  is_correct: boolean | null
}

/** Aciertos y total por usuario (solo predicciones ya puntuadas: is_correct no nulo). */
export function resumenPorUsuario(preds: PrediccionPuntuada[]): Map<string, { aciertos: number; total: number }> {
  const out = new Map<string, { aciertos: number; total: number }>()
  for (const p of preds) {
    if (!p.user_id || p.is_correct === null || p.is_correct === undefined) continue
    const r = out.get(p.user_id) ?? { aciertos: 0, total: 0 }
    r.total += 1
    if (p.is_correct) r.aciertos += 1
    out.set(p.user_id, r)
  }
  return out
}

/** Texto del aviso de cierre de Jornada. */
export function textoAvisoJornada(aciertos: number, total: number): { title: string; body: string } {
  const title = `Jornada: acertaste ${aciertos} de ${total}`
  const body =
    total > 0 && aciertos === total ? '¡Pleno! Mira tus puntos y la clasificación.'
    : aciertos === 0 ? 'Esta vez no hubo suerte. La próxima Jornada ya está abierta.'
    : 'Mira tus puntos y cómo va la clasificación.'
  return { title, body }
}

/**
 * Clave de idempotencia del aviso en `favorites_push_log` (PK user_id+week).
 * Se reutiliza esa tabla técnica en vez de crear otra: el prefijo `jornada:`
 * no choca nunca con las semanas ISO (`2026-W40`) que escribe favorites-push,
 * y su purga de 60 días no afecta (una Jornada se cierra en días).
 */
export function claveAvisoJornada(weekKey: string): string {
  return `jornada:${weekKey}`
}

type Admin = SupabaseClient

/**
 * Insignias para quien acertó en los partidos puntuados EN ESTA pasada.
 * «Primer acierto» = no tiene ningún otro acierto fuera de estos partidos (si
 * acertó dos a la vez, también es su primera vez).
 */
export async function otorgarInsigniasDeAcierto(admin: Admin, eventIds: string[]): Promise<number> {
  if (eventIds.length === 0) return 0
  const { data: ganadores, error } = await admin
    .from('ranked_predictions')
    .select('user_id')
    .in('event_id', eventIds)
    .eq('is_correct', true)
  if (error || !ganadores) return 0

  let otorgadas = 0
  const usuarios = [...new Set((ganadores as Array<{ user_id: string }>).map(g => g.user_id))]
  for (const uid of usuarios) {
    try {
      const lista = `(${eventIds.map(id => `"${id.replace(/"/g, '')}"`).join(',')})`
      const { count, error: cErr } = await admin
        .from('ranked_predictions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('is_correct', true)
        .not('event_id', 'in', lista)
      if (cErr) continue
      const earned = badgesEarnedOnRankedCorrect({ isFirstCorrect: (count ?? 0) === 0 })
      if (earned.length > 0) {
        const r = await awardBadges(admin, uid, earned)
        otorgadas += r.awarded.length
      }
      // Los puntos recién acreditados pueden subirle de nivel (cosméticos por nivel, idempotente).
      void processLevelProgression(admin, uid).catch(() => {})
    } catch (e) {
      console.warn('[jornada-avisos] insignias fallaron para un usuario', (e as Error).message)
    }
  }
  return otorgadas
}

/**
 * Para cada Jornada tocada en esta pasada que haya quedado ENTERA resuelta,
 * manda a cada participante «Jornada: acertaste X de Y», una sola vez por
 * usuario y Jornada (reclama la fila en favorites_push_log antes de enviar:
 * como mucho una vez; mejor no avisar que duplicar).
 */
export async function avisarJornadasCerradas(admin: Admin, weekKeys: Iterable<string>): Promise<{ jornadas: number; avisados: number }> {
  let jornadas = 0
  let avisados = 0
  for (const weekKey of weekKeys) {
    try {
      const { data: eventos, error } = await admin
        .from('ranked_events')
        .select('id, status')
        .eq('sport', RANKED_FOOTBALL_SPORT)
        .eq('meta->>week_key', weekKey)
      if (error || !eventos || eventos.length === 0) continue
      if ((eventos as Array<{ status: string }>).some(e => e.status !== 'resolved')) continue // aún sin cerrar

      const ids = (eventos as Array<{ id: string }>).map(e => e.id)
      const { data: preds, error: pErr } = await admin
        .from('ranked_predictions')
        .select('user_id, event_id, is_correct')
        .in('event_id', ids)
      if (pErr || !preds) continue
      const resumen = resumenPorUsuario(preds as PrediccionPuntuada[])
      if (resumen.size === 0) continue
      jornadas++

      const week = claveAvisoJornada(weekKey)
      const { data: reclamados, error: claimErr } = await admin
        .from('favorites_push_log')
        .upsert([...resumen.keys()].map(user_id => ({ user_id, week })), { onConflict: 'user_id,week', ignoreDuplicates: true })
        .select('user_id')
      if (claimErr || !reclamados) continue

      const envios = await Promise.allSettled(
        (reclamados as Array<{ user_id: string }>).map(({ user_id }) => {
          const r = resumen.get(user_id)!
          return sendPushToUser(user_id, {
            ...textoAvisoJornada(r.aciertos, r.total),
            url: '/predicciones',
            tag: `jornada-${weekKey}`,
            topic: 'quiniela',
          })
        }),
      )
      avisados += envios.filter(e => e.status === 'fulfilled' && e.value.sent > 0).length
    } catch (e) {
      console.warn(`[jornada-avisos] aviso de la Jornada ${weekKey} falló`, (e as Error).message)
    }
  }
  return { jornadas, avisados }
}
