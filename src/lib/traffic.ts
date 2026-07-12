// Datos del panel /admin/trafico — capa de "adquisición": cómo llega la gente a
// la WEB (GA4 + Search Console). Complementa a seo-audit (salud) y, cuando se
// conecte, a las descargas de la APP (App Store Connect).
//
// GA4 mide gente que ENTRA a la web; Search Console mide apariciones/clics EN
// Google. Son números distintos a propósito. Todo degrada con elegancia: si
// falta una credencial, el bloque dice "pendiente" en vez de romper.
//
// Auth (./google-auth): GA4 usa service account primero (el token OAuth de
// usuario suele no tener el scope analytics.readonly). GSC usa OAuth primero.

import { getServiceAccountToken, getOauthAccessToken, hasServiceAccount } from './google-auth'

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '478319346' // propiedad "Deportes"
const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || null
const GSC_SITE_URL = process.env.SEARCH_CONSOLE_SITE_URL || 'https://www.takasportsmedia.com/'
const ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const WEBMASTERS_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const FETCH_TIMEOUT_MS = 12_000

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface Ga4Day { date: string; users: number }
export interface Ga4Channel { channel: string; users: number; pct: number }
export interface Ga4Page { path: string; views: number }

export interface Ga4Summary {
  available: boolean
  propertyId: string
  measurementId: string | null
  via?: 'service-account' | 'oauth'
  series?: Ga4Day[]
  yesterday?: number
  dayBefore?: number
  avg7?: number
  organicPct?: number
  trend?: 'up' | 'down' | 'flat'
  channels?: Ga4Channel[]
  topPages?: Ga4Page[]
  hasServiceAccount: boolean
  note?: string
}

export interface GscItem {
  key: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}
export interface SearchDetail {
  available: boolean
  topPages?: GscItem[]
  topQueries?: GscItem[]
  note?: string
}

// ── Utilidades ───────────────────────────────────────────────────────────────

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const trendOf = (cur: number, base: number): 'up' | 'down' | 'flat' => {
  if (base === 0) return cur > 0 ? 'up' : 'flat'
  const diff = (cur - base) / base
  if (diff > 0.05) return 'up'
  if (diff < -0.05) return 'down'
  return 'flat'
}

function ymd(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** "20260712" (GA4) → "2026-07-12". */
function fmtGaDate(s: string): string {
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s
}

/** Acorta un pagePath largo para pintarlo (deja "/" y recorta la cola). */
export function shortPath(p: string): string {
  if (!p || p === '/') return '/ (portada)'
  const clean = p.split('?')[0]
  return clean.length > 40 ? clean.slice(0, 39) + '…' : clean
}

// ── GA4 (Data API) ─────────────────────────────────────────────────────────

interface Ga4Row {
  dimensionValues?: { value?: string }[]
  metricValues?: { value?: string }[]
}

async function ga4RunReport(token: string, body: Record<string, unknown>): Promise<Ga4Row[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200)
    if (res.status === 403) {
      throw new Error(
        `GA4 403: la credencial no tiene acceso a la propiedad ${GA4_PROPERTY_ID} (o falta el scope analytics.readonly)`,
      )
    }
    throw new Error(`GA4 runReport ${res.status}: ${detail}`)
  }
  const data = (await res.json()) as { rows?: Ga4Row[] }
  return data.rows ?? []
}

export async function getGa4Summary(): Promise<Ga4Summary> {
  const baseline: Ga4Summary = {
    available: false,
    propertyId: GA4_PROPERTY_ID,
    measurementId: GA4_MEASUREMENT_ID,
    hasServiceAccount: hasServiceAccount(),
  }

  // GA4 necesita scope analytics.readonly → service account primero.
  let token: string | null = null
  let via: 'service-account' | 'oauth' | undefined
  try {
    token = await getServiceAccountToken([ANALYTICS_SCOPE])
    if (token) via = 'service-account'
    if (!token) {
      token = await getOauthAccessToken()
      if (token) via = 'oauth'
    }
  } catch (e) {
    return { ...baseline, note: `auth GA4: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!token) return { ...baseline, note: 'Sin service account de Google configurada (GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY)' }

  try {
    // 1) Usuarios activos por día — últimos 8 días completos (hasta ayer).
    const daily = await ga4RunReport(token, {
      dateRanges: [{ startDate: '8daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    })
    const series: Ga4Day[] = daily
      .map((r) => ({ date: fmtGaDate(r.dimensionValues?.[0]?.value ?? ''), users: Number(r.metricValues?.[0]?.value ?? 0) }))
      .filter((d) => d.date)

    const yesterday = series[series.length - 1]?.users ?? 0
    const dayBefore = series.length >= 2 ? series[series.length - 2].users : 0
    const avg7 = mean(series.slice(-7).map((d) => d.users))

    // 2) Reparto por canal (7d) — de dónde llega la gente.
    let channels: Ga4Channel[] | undefined
    let organicPct: number | undefined
    try {
      const byChannel = await ga4RunReport(token, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      })
      const rows = byChannel.map((r) => ({ channel: r.dimensionValues?.[0]?.value ?? '—', users: Number(r.metricValues?.[0]?.value ?? 0) }))
      const total = rows.reduce((s, r) => s + r.users, 0)
      if (total > 0) {
        channels = rows.map((r) => ({ ...r, pct: Math.round((r.users / total) * 100) }))
        organicPct = channels.find((c) => /organic/i.test(c.channel))?.pct
      }
    } catch { /* el reparto por canal es secundario */ }

    // 3) Top páginas/pantallas (7d) — qué se ve más.
    let topPages: Ga4Page[] | undefined
    try {
      const pages = await ga4RunReport(token, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 8,
      })
      topPages = pages.map((r) => ({ path: r.dimensionValues?.[0]?.value ?? '', views: Number(r.metricValues?.[0]?.value ?? 0) })).filter((p) => p.path)
    } catch { /* top páginas secundario */ }

    return {
      ...baseline,
      available: true,
      via,
      series,
      yesterday,
      dayBefore,
      avg7,
      organicPct,
      trend: trendOf(yesterday, avg7),
      channels,
      topPages,
    }
  } catch (e) {
    return { ...baseline, via, note: e instanceof Error ? e.message : String(e) }
  }
}

// ── Search Console: detalle (top páginas + top búsquedas) ─────────────────────

interface GscApiRow { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }

async function gscQuery(token: string, dimension: 'page' | 'query'): Promise<GscItem[]> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    // Ventana de 7 días terminada hace 3 (GSC va ~2-3 días retrasado).
    body: JSON.stringify({ startDate: ymd(9), endDate: ymd(3), dimensions: [dimension], rowLimit: 8 }),
  })
  if (!res.ok) throw new Error(`GSC ${dimension} ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const data = (await res.json()) as { rows?: GscApiRow[] }
  return (data.rows ?? []).map((r) => ({ key: r.keys?.[0] ?? '', clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
}

export async function getSearchDetail(): Promise<SearchDetail> {
  let token: string | null
  try {
    token = (await getOauthAccessToken()) ?? (await getServiceAccountToken([WEBMASTERS_SCOPE]))
  } catch (e) {
    return { available: false, note: `auth GSC: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!token) return { available: false, note: 'Google sin configurar' }

  try {
    const [topPages, topQueries] = await Promise.all([gscQuery(token, 'page'), gscQuery(token, 'query')])
    return { available: true, topPages, topQueries }
  } catch (e) {
    return { available: false, note: e instanceof Error ? e.message : String(e) }
  }
}
