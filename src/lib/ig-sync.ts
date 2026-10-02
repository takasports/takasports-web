// Sincronización de los reels de @taka.sports — server-side, la llama el cron
// /api/cron/instagram-sync (cada hora) y el callback OAuth justo después de
// autorizar.
//
// Sustituye al WF-10 de n8n, que raspaba la web pública de Instagram sin sesión
// y murió el 20/09/2026 (Instagram cerró ese acceso: 401). Lo hace con el Graph
// API OFICIAL y, además, arregla las tres cosas que rompían la sección:
//
//   1. El token se renueva solo (con ≤50 días de vida; dura 60) y se avisa por
//      Telegram si falta, si Instagram lo revoca o si quedan ≤7 días.
//   2. Las miniaturas se COPIAN a Supabase Storage (bucket público `reels`, que
//      ya existía para reels.json): `reels/thumbs/<código>.jpg`. Esa URL no
//      caduca nunca, a diferencia de las firmadas de Instagram (`oe`).
//   3. Sin token sigue haciendo algo útil ("modo reparación"): rehace las
//      miniaturas de los reels que ya hay en reels.json pidiéndolas por código
//      corto a la página pública del post, y quita los vídeos caducados.
//
// Escribe reels.json SOLO si cambia, y nunca lo deja vacío.

import { adminSupabase } from './supabase-admin'
import { readIgTokenRecord, refreshIgToken, readSyncStatus, writeSyncStatus } from './ig-token'
import { fetchIgImage, fetchThumbByShortcode } from './ig-media'
import { igUrlExpired, shortcodeOf, thumbBySc } from './reel-thumbs'
import { detectSport, extractTitle } from './instagram'
import { sendTelegram } from './telegram'
import {
  planToken, isAuthError, alertDue, graphToReels, publicThumbUrl, thumbPath,
  SYNC_STALE_HOURS, MAX_REELS, type GraphMedia, type TokenPlan,
} from './ig-sync-core'

const BUCKET = 'reels'
const REELS_OBJECT = 'reels.json'
const AUTH_URL = 'https://www.takasportsmedia.com/api/instagram/auth'

export interface SyncedReel {
  id: string
  shortcode: string
  instagram_url: string
  thumbnail_url: string | null
  video_url: string | null
  timestamp: string
  caption: string
  sport: string
  title: string
}

type AlertKind = 'no_token' | 'token_invalid' | 'token_expiring' | 'sync_stale'

interface SyncStatus {
  lastRunAt: string
  lastOkAt: string | null
  lastError: string | null
  mode: 'graph' | 'repair'
  tokenDaysLeft: number | null
  /** Último envío de cada aviso (para no repetirlo cada hora). */
  alertsSentAt: Partial<Record<AlertKind, string>>
  /** Avisos vigentes en la última corrida (para mandar el "ya está" al curarse). */
  activeAlerts: AlertKind[]
}

export interface SyncReport {
  ok: boolean
  mode: 'graph' | 'repair'
  token: { state: TokenPlan['state'] | 'invalid'; daysLeft: number | null; source: 'store' | 'env' | null; refresh?: string }
  graphError?: string
  reels: number
  newThumbs: number
  thumbsFromStorage: number
  wroteReelsJson: boolean
  alerts: AlertKind[]
  alertsSent: AlertKind[]
  errors: string[]
}

// ── Graph API ────────────────────────────────────────────────────────────────

async function fetchGraphMedia(token: string): Promise<
  { ok: true; items: GraphMedia[] } | { ok: false; auth: boolean; error: string }
> {
  try {
    const url = new URL('https://graph.instagram.com/me/media')
    url.searchParams.set('fields', 'id,media_type,media_product_type,media_url,thumbnail_url,permalink,shortcode,timestamp,caption')
    url.searchParams.set('limit', '50')
    url.searchParams.set('access_token', token)
    const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
      const err = data.error as { code?: number; type?: string; message?: string } | undefined
      return { ok: false, auth: isAuthError(err), error: err?.message ?? `HTTP ${res.status}` }
    }
    return { ok: true, items: Array.isArray(data.data) ? data.data : [] }
  } catch (e) {
    return { ok: false, auth: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Storage ──────────────────────────────────────────────────────────────────

async function readCurrentReels(supaUrl: string): Promise<SyncedReel[]> {
  try {
    const res = await fetch(`${supaUrl}/storage/v1/object/public/${BUCKET}/${REELS_OBJECT}`, {
      cache: 'no-store', signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/** Saca la URL original de Instagram de una envuelta en el proxy. */
function unwrapProxy(u: string | null | undefined): string | null {
  if (!u) return null
  const m = u.match(/[?&]url=([^&]+)/)
  try { return m ? decodeURIComponent(m[1]) : (/^https?:\/\//.test(u) ? u : null) } catch { return null }
}

interface Candidate {
  id: string
  shortcode: string
  instagram_url: string
  timestamp: string
  caption: string
  sport: string
  title: string
  rawThumb: string | null
  rawVideo: string | null
}

// ── Avisos ───────────────────────────────────────────────────────────────────

function alertText(kind: AlertKind, ctx: { daysLeft: number | null; error: string | null; hoursStale: number | null }): string {
  const pasos =
    `\n\n<b>Cómo se arregla (2 minutos):</b>\n` +
    `1. Entra en takasportsmedia.com/perfil con tu correo de administrador.\n` +
    `2. Abre ${AUTH_URL}\n` +
    `3. Entra con la cuenta de Instagram @taka.sports y pulsa «Permitir».\n` +
    `Al volver verás «Token obtenido y guardado». Los reels se ponen al día solos.`
  switch (kind) {
    case 'no_token':
      return `📸 <b>Reels: Instagram no está conectado</b>\nLa web no tiene permiso para leer @taka.sports, así que los reels nuevos no aparecen.` + pasos
    case 'token_invalid':
      return `📸 <b>Reels: Instagram ha cortado el permiso</b>\nEl permiso caducó o se revocó${ctx.error ? ` (${ctx.error})` : ''}. Hay que volver a darlo.` + pasos
    case 'token_expiring':
      return `📸 <b>Reels: el permiso de Instagram caduca en ${Math.max(0, Math.floor(ctx.daysLeft ?? 0))} días</b>\nLa renovación automática está fallando${ctx.error ? ` (${ctx.error})` : ''}. Si llega a caducar, los reels se paran.` + pasos
    case 'sync_stale':
      return `📸 <b>Reels: ${ctx.hoursStale !== null ? `${Math.round(ctx.hoursStale)} h` : 'tiempo'} sin sincronizar con Instagram</b>\nÚltimo error: ${ctx.error ?? 'desconocido'}.\nSuele ser algo pasajero de Instagram; si dura más de un día, mira los logs de /api/cron/instagram-sync.`
  }
}

// ── Sincronización ───────────────────────────────────────────────────────────

export async function syncInstagramReels(opts: { dry?: boolean; notify?: boolean; budgetMs?: number } = {}): Promise<SyncReport> {
  const dry = !!opts.dry
  const notify = opts.notify !== false && !dry
  const started = Date.now()
  const deadline = started + (opts.budgetMs ?? 40_000)
  const errors: string[] = []

  const admin = adminSupabase()
  const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  if (!admin || !supaUrl) {
    return {
      ok: false, mode: 'repair', token: { state: 'missing', daysLeft: null, source: null },
      reels: 0, newThumbs: 0, thumbsFromStorage: 0, wroteReelsJson: false, alerts: [], alertsSent: [],
      errors: ['supabase_unavailable'],
    }
  }

  // 1) Token: leer, y renovar si toca.
  let rec = await readIgTokenRecord()
  const plan = planToken(rec, started)
  let tokenState: SyncReport['token']['state'] = plan.state
  let tokenDaysLeft = plan.daysLeft
  let refreshDetail: string | undefined
  let refreshError: string | null = null
  if (rec && plan.refresh && !dry) {
    const r = await refreshIgToken(rec.value)
    refreshDetail = r.detail
    if (r.ok) {
      rec = (await readIgTokenRecord()) ?? rec
      if (r.expiresInSec) tokenDaysLeft = r.expiresInSec / 86_400
      tokenState = 'ok'
    } else {
      refreshError = r.detail
      errors.push(`refresh: ${r.detail}`)
    }
  }

  // 2) Reels del Graph API.
  let graphReels: ReturnType<typeof graphToReels> | null = null
  let graphError: string | undefined
  if (rec && tokenState !== 'expired') {
    const g = await fetchGraphMedia(rec.value)
    if (g.ok) {
      graphReels = graphToReels(g.items)
    } else {
      graphError = g.error
      errors.push(`graph: ${g.error}`)
      if (g.auth) tokenState = 'invalid'
    }
  }

  // 3) Candidatos: los del Graph o, sin él, los que ya hay en reels.json.
  const current = await readCurrentReels(supaUrl)
  const mode: SyncReport['mode'] = graphReels ? 'graph' : 'repair'
  const candidates: Candidate[] = graphReels
    ? graphReels.map((g) => ({
        id: g.id, shortcode: g.shortcode, instagram_url: g.instagram_url, timestamp: g.timestamp,
        caption: g.caption, sport: detectSport(g.caption), title: extractTitle(g.caption),
        rawThumb: g.rawThumb, rawVideo: g.rawVideo,
      }))
    : current.slice(0, MAX_REELS).flatMap((r) => {
        const sc = r.shortcode || shortcodeOf(r.instagram_url)
        if (!sc || !r.id) return []
        return [{
          id: r.id, shortcode: sc, instagram_url: `https://www.instagram.com/reel/${sc}/`, timestamp: r.timestamp,
          caption: r.caption ?? '', sport: r.sport ?? '', title: r.title ?? extractTitle(r.caption ?? ''),
          // Las de Storage ya son estables: se tratan como "ya copiadas" abajo.
          rawThumb: unwrapProxy(r.thumbnail_url), rawVideo: unwrapProxy(r.video_url),
        }]
      })

  // 4) Miniaturas: la copia en Storage manda; si falta, se crea.
  const have = new Set<string>()
  {
    const { data, error } = await admin.storage.from(BUCKET).list('thumbs', { limit: 1000 })
    if (error) errors.push(`storage.list: ${error.message}`)
    for (const f of data ?? []) have.add(f.name)
  }
  let newThumbs = 0
  let thumbsFromStorage = 0
  const items: SyncedReel[] = []
  for (const c of candidates) {
    const file = `${c.shortcode}.jpg`
    let thumb: string | null = null
    if (have.has(file)) {
      thumb = publicThumbUrl(supaUrl, c.shortcode)
      thumbsFromStorage++
    } else if (!dry && Date.now() < deadline) {
      const fresh = c.rawThumb && !igUrlExpired(c.rawThumb) ? await fetchIgImage(c.rawThumb) : null
      const img = fresh ?? (await fetchThumbByShortcode(c.shortcode))
      if (img) {
        const { error } = await admin.storage.from(BUCKET).upload(thumbPath(c.shortcode), Buffer.from(img.body), {
          contentType: img.contentType, upsert: true, cacheControl: '31536000',
        })
        if (error) errors.push(`upload ${c.shortcode}: ${error.message}`)
        else { thumb = publicThumbUrl(supaUrl, c.shortcode); newThumbs++; have.add(file) }
      }
    }
    if (!thumb) {
      // Reserva: la firmada si aún vale (vía proxy) y si no, la de código corto,
      // que no caduca. Nunca null: un reel de Instagram SIEMPRE tiene portada.
      thumb = c.rawThumb && !igUrlExpired(c.rawThumb) && !c.rawThumb.includes('/storage/v1/')
        ? `/api/instagram/thumbnail?url=${encodeURIComponent(c.rawThumb)}`
        : thumbBySc(c.shortcode)
    }
    const video = c.rawVideo && !igUrlExpired(c.rawVideo)
      ? `/api/instagram/video?url=${encodeURIComponent(c.rawVideo)}`
      : null
    items.push({
      id: c.id, shortcode: c.shortcode, instagram_url: c.instagram_url,
      thumbnail_url: thumb, video_url: video, timestamp: c.timestamp,
      caption: c.caption, sport: c.sport, title: c.title,
    })
  }

  // 5) reels.json: solo si cambia y nunca vacío.
  let wroteReelsJson = false
  if (items.length > 0 && JSON.stringify(items) !== JSON.stringify(current) && !dry) {
    const { error } = await admin.storage.from(BUCKET).upload(REELS_OBJECT, Buffer.from(JSON.stringify(items, null, 2)), {
      contentType: 'application/json', upsert: true, cacheControl: '300',
    })
    if (error) errors.push(`upload reels.json: ${error.message}`)
    else wroteReelsJson = true
  }

  // 6) Estado y avisos.
  const now = Date.now()
  const prev = await readSyncStatus<SyncStatus>()
  const ok = mode === 'graph' && !errors.some((e) => e.startsWith('upload reels.json'))
  const lastOkAt = ok ? new Date(now).toISOString() : (prev.lastOkAt ?? null)
  const hoursStale = lastOkAt ? (now - new Date(lastOkAt).getTime()) / 3_600_000 : null

  const alerts: AlertKind[] = []
  if (tokenState === 'missing') alerts.push('no_token')
  else if (tokenState === 'expired' || tokenState === 'invalid') alerts.push('token_invalid')
  else {
    if (tokenDaysLeft !== null && tokenDaysLeft <= 7) alerts.push('token_expiring')
    if (!ok && (hoursStale === null || hoursStale >= SYNC_STALE_HOURS)) alerts.push('sync_stale')
  }

  const alertsSentAt = { ...(prev.alertsSentAt ?? {}) }
  const alertsSent: AlertKind[] = []
  if (notify) {
    const ctx = { daysLeft: tokenDaysLeft, error: refreshError ?? graphError ?? errors[0] ?? null, hoursStale }
    for (const kind of alerts) {
      if (!alertDue(alertsSentAt[kind], now)) continue
      const r = await sendTelegram(alertText(kind, ctx))
      if (r.sent) { alertsSentAt[kind] = new Date(now).toISOString(); alertsSent.push(kind) }
    }
    if (alerts.length === 0 && (prev.activeAlerts?.length ?? 0) > 0) {
      await sendTelegram(`✅ <b>Reels de Instagram de nuevo al día</b>\n${items.length} reels sincronizados${newThumbs ? `, ${newThumbs} portadas nuevas guardadas` : ''}.`)
    }
  }

  if (!dry) {
    const status: SyncStatus = {
      lastRunAt: new Date(now).toISOString(),
      lastOkAt,
      lastError: errors[0] ?? null,
      mode,
      tokenDaysLeft: tokenDaysLeft !== null ? Math.round(tokenDaysLeft * 10) / 10 : null,
      alertsSentAt,
      activeAlerts: alerts,
    }
    await writeSyncStatus(status)
  }

  return {
    ok,
    mode,
    token: {
      state: tokenState,
      daysLeft: tokenDaysLeft !== null ? Math.round(tokenDaysLeft * 10) / 10 : null,
      source: rec?.source ?? null,
      refresh: refreshDetail,
    },
    graphError,
    reels: items.length,
    newThumbs,
    thumbsFromStorage,
    wroteReelsJson,
    alerts,
    alertsSent,
    errors,
  }
}
