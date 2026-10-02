// Reglas puras de la sincronización de reels con Instagram: cuándo renovar el
// token, cuándo avisar, cómo traducir la respuesta del Graph API. Sin red, sin
// variables de entorno y sin Supabase, para poder probarlo entero con vitest.
// La parte con efectos vive en ig-sync.ts.

import { shortcodeOf } from './reel-thumbs'

const DAY_MS = 86_400_000

/** Con ≤50 días de vida se renueva. El token largo dura 60, así que se renueva
 *  más o menos cada 10 días y, si una renovación falla, quedan 50 días de
 *  reintentos (cada hora) antes de que caduque. */
export const REFRESH_WHEN_DAYS_LEFT = 50

/** Con ≤7 días de vida (es decir, la renovación lleva 40 días fallando) se
 *  avisa por Telegram: a partir de aquí solo lo arregla una persona. */
export const ALERT_WHEN_DAYS_LEFT = 7

/** Si la última sincronización buena tiene más de esto, se avisa. */
export const SYNC_STALE_HOURS = 6

/** Ningún aviso se repite antes de este plazo (los crons corren cada hora). */
export const ALERT_COOLDOWN_HOURS = 24

/** Reels que se guardan en reels.json (y cuyas miniaturas se copian). */
export const MAX_REELS = 30

export interface TokenRecord {
  value: string
  /** null = caducidad desconocida (token pegado a mano en la env de Vercel). */
  expiresAt: string | null
  /** null = no viene del almacén (env). */
  updatedAt: string | null
  source: 'store' | 'env'
}

export interface TokenPlan {
  refresh: boolean
  daysLeft: number | null
  state: 'missing' | 'ok' | 'expiring' | 'expired'
}

export function daysLeft(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null
  const t = new Date(expiresAt).getTime()
  if (!Number.isFinite(t)) return null
  return (t - now) / DAY_MS
}

/**
 * Decide si toca renovar el token y en qué estado está.
 *
 * Meta solo deja renovar un token largo que tenga AL MENOS 24 h y que no haya
 * caducado; uno caducado ya no se puede renovar y hay que volver a autorizar.
 */
export function planToken(rec: TokenRecord | null, now: number): TokenPlan {
  if (!rec) return { refresh: false, daysLeft: null, state: 'missing' }
  const left = daysLeft(rec.expiresAt, now)
  const ageMs = rec.updatedAt ? now - new Date(rec.updatedAt).getTime() : Infinity
  const oldEnough = !Number.isFinite(ageMs) || ageMs >= DAY_MS

  if (left !== null && left <= 0) return { refresh: false, daysLeft: left, state: 'expired' }

  // Caducidad desconocida (viene de la env): se renueva en cuanto se pueda, que
  // es la forma de meterlo en el almacén CON fecha y que a partir de ahí se
  // gestione solo.
  const wantsRefresh = left === null || left <= REFRESH_WHEN_DAYS_LEFT
  const state = left !== null && left <= ALERT_WHEN_DAYS_LEFT ? 'expiring' : 'ok'
  return { refresh: wantsRefresh && oldEnough, daysLeft: left, state }
}

/** ¿El error del Graph API significa "este token ya no vale"? (código 190 o
 *  OAuthException). Cualquier otro error es transitorio y no pide reautorizar. */
export function isAuthError(err: { code?: number; type?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === 190 || err.type === 'OAuthException'
}

/** ¿Ha pasado el plazo desde el último aviso de este tipo? */
export function alertDue(lastSentIso: string | null | undefined, now: number, hours = ALERT_COOLDOWN_HOURS): boolean {
  if (!lastSentIso) return true
  const t = new Date(lastSentIso).getTime()
  return !Number.isFinite(t) || now - t >= hours * 3_600_000
}

export interface GraphMedia {
  id: string
  media_type?: string
  media_product_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  shortcode?: string
  timestamp?: string
  caption?: string
}

/** Reel ya normalizado, antes de decidir su miniatura definitiva. */
export interface GraphReel {
  id: string
  shortcode: string
  instagram_url: string
  timestamp: string
  caption: string
  /** URL firmada recién salida del Graph (caduca en días). */
  rawThumb: string | null
  rawVideo: string | null
}

/** Se queda con los vídeos (reels) y los ordena del más nuevo al más viejo. */
export function graphToReels(items: readonly GraphMedia[]): GraphReel[] {
  const out: GraphReel[] = []
  for (const m of items) {
    const isVideo = m.media_type === 'VIDEO' || m.media_type === 'REELS' || m.media_product_type === 'REELS'
    if (!isVideo || !m.id) continue
    const sc = m.shortcode || shortcodeOf(m.permalink)
    if (!sc) continue
    out.push({
      id: m.id,
      shortcode: sc,
      // Enlace canónico al reel: en el móvil abre la app de Instagram (enlace
      // universal), en escritorio la web. Se normaliza para no depender de
      // cómo venga el permalink (/reel/ o /p/).
      instagram_url: `https://www.instagram.com/reel/${sc}/`,
      timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date(0).toISOString(),
      caption: m.caption ?? '',
      rawThumb: m.thumbnail_url ?? null,
      rawVideo: m.media_url ?? null,
    })
  }
  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, MAX_REELS)
}

/** Ruta, dentro del bucket público `reels`, de la miniatura guardada. */
export function thumbPath(sc: string): string {
  return `thumbs/${sc}.jpg`
}

export function publicThumbUrl(supabaseUrl: string, sc: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/reels/${thumbPath(sc)}`
}
