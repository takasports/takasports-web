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
import { adminSupabase } from './supabase-admin'

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
export interface Ga4Device { category: string; users: number; pct: number }
export interface Ga4Country { country: string; countryCode: string; users: number }

export interface Ga4Summary {
  available: boolean
  propertyId: string
  measurementId: string | null
  via?: 'service-account' | 'oauth'
  series?: Ga4Day[] // 30 días
  yesterday?: number
  dayBefore?: number
  avg7?: number
  total28?: number
  sessions28?: number
  newUsers28?: number
  organicPct?: number
  trend?: 'up' | 'down' | 'flat'
  channels?: Ga4Channel[]
  topPages?: Ga4Page[]
  devices?: Ga4Device[]
  webCountries?: Ga4Country[]
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
    const t = token
    const safe = async (fn: () => Promise<Ga4Row[]>): Promise<Ga4Row[] | undefined> => {
      try { return await fn() } catch { return undefined }
    }

    // Serie de 30 días (esencial) + enriquecimiento en paralelo (cada uno degrada).
    const [daily, channelsRes, pagesRes, devicesRes, countriesRes, totalsRes] = await Promise.all([
      ga4RunReport(t, {
        dateRanges: [{ startDate: '29daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      safe(() => ga4RunReport(t, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      })),
      safe(() => ga4RunReport(t, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 8,
      })),
      safe(() => ga4RunReport(t, {
        dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      })),
      safe(() => ga4RunReport(t, {
        dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'country' }, { name: 'countryId' }], metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8,
      })),
      safe(() => ga4RunReport(t, {
        dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'newUsers' }],
      })),
    ])

    const series: Ga4Day[] = daily
      .map((r) => ({ date: fmtGaDate(r.dimensionValues?.[0]?.value ?? ''), users: Number(r.metricValues?.[0]?.value ?? 0) }))
      .filter((d) => d.date)
    const yesterday = series[series.length - 1]?.users ?? 0
    const dayBefore = series.length >= 2 ? series[series.length - 2].users : 0
    const avg7 = mean(series.slice(-7).map((d) => d.users))

    // Canales + % orgánico
    let channels: Ga4Channel[] | undefined, organicPct: number | undefined
    if (channelsRes?.length) {
      const rows = channelsRes.map((r) => ({ channel: r.dimensionValues?.[0]?.value ?? '—', users: Number(r.metricValues?.[0]?.value ?? 0) }))
      const total = rows.reduce((s, r) => s + r.users, 0)
      if (total > 0) {
        channels = rows.map((r) => ({ ...r, pct: Math.round((r.users / total) * 100) }))
        organicPct = channels.find((c) => /organic/i.test(c.channel))?.pct
      }
    }
    // Top páginas
    const topPages = pagesRes
      ?.map((r) => ({ path: r.dimensionValues?.[0]?.value ?? '', views: Number(r.metricValues?.[0]?.value ?? 0) }))
      .filter((p) => p.path)
    // Dispositivos
    let devices: Ga4Device[] | undefined
    if (devicesRes?.length) {
      const rows = devicesRes.map((r) => ({ category: r.dimensionValues?.[0]?.value ?? '', users: Number(r.metricValues?.[0]?.value ?? 0) }))
      const total = rows.reduce((s, r) => s + r.users, 0)
      if (total > 0) devices = rows.map((r) => ({ ...r, pct: Math.round((r.users / total) * 100) }))
    }
    // Países del tráfico web
    const webCountries = countriesRes
      ?.map((r) => ({ country: r.dimensionValues?.[0]?.value ?? '', countryCode: r.dimensionValues?.[1]?.value ?? '', users: Number(r.metricValues?.[0]?.value ?? 0) }))
      .filter((c) => c.users > 0)
    // Totales 28d
    const tv = totalsRes?.[0]?.metricValues
    const total28 = tv ? Number(tv[0]?.value ?? 0) : undefined
    const sessions28 = tv ? Number(tv[1]?.value ?? 0) : undefined
    const newUsers28 = tv ? Number(tv[2]?.value ?? 0) : undefined

    return {
      ...baseline, available: true, via, series, yesterday, dayBefore, avg7,
      total28, sessions28, newUsers28, organicPct, trend: trendOf(yesterday, avg7),
      channels, topPages, devices, webCountries,
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

// ── Descargas app iOS (desde Supabase traffic_daily) ──────────────────────────
// La foto diaria la escribe taka-system (informe de las 9:15) con la .p8 de Apple;
// la web solo LEE la última fila (la credencial de Apple no vive en Vercel).

export interface AppDownloads {
  available: boolean
  day?: string
  yesterday?: number
  d7?: number
  total?: number
  launchDate?: string
  countries?: [string, number][]
  note?: string
}

interface TrafficRowRaw {
  app?: { launchDate?: string; countries?: [string, number][]; pending?: boolean; error?: string; empty?: boolean }
}

export async function getAppDownloads(): Promise<AppDownloads> {
  const supa = adminSupabase()
  if (!supa) return { available: false, note: 'Supabase no configurado' }

  const { data, error } = await supa
    .from('traffic_daily')
    .select('day, ios_downloads_yesterday, ios_downloads_7d, ios_downloads_total, raw')
    .order('day', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { available: false, note: error.message }
  if (!data) return { available: false, note: 'aún sin datos (el informe diario corre a las 9:15)' }

  const row = data as {
    day: string
    ios_downloads_yesterday: number | null
    ios_downloads_7d: number | null
    ios_downloads_total: number | null
    raw: TrafficRowRaw | null
  }
  const app = row.raw?.app
  // Sin cifras y con la capa iOS en error/pendiente → tratar como no disponible.
  if (row.ios_downloads_total == null && (app?.pending || app?.error || app?.empty)) {
    return { available: false, note: app?.error ?? 'App Store Connect aún sin datos/credenciales' }
  }

  return {
    available: true,
    day: row.day,
    yesterday: row.ios_downloads_yesterday ?? undefined,
    d7: row.ios_downloads_7d ?? undefined,
    total: row.ios_downloads_total ?? undefined,
    launchDate: app?.launchDate,
    countries: app?.countries,
  }
}

// ── Search Console: totales por VENTANA (28d / 7d) ────────────────────────────
// Antes el panel mostraba UN día suelto → parecía "mal" frente a la UI de Search
// Console, que muestra rangos (28 días, 3 meses…). Esto da totales claros que
// cuadran con lo que ve el usuario en Google.

export interface GscWindow { clicks: number; impressions: number; ctr: number; position: number }
export interface SearchTotals {
  available: boolean
  h24?: GscWindow
  d28?: GscWindow
  d7?: GscWindow
  series?: { date: string; clicks: number }[]
  rangeStart?: string
  rangeEnd?: string
  note?: string
}

// Últimas 24h con datos HORARIOS (iguala la vista "24 horas" de Search Console).
async function gscHourly24(token: string): Promise<GscWindow> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ startDate: ymd(1), endDate: ymd(0), dimensions: ['HOUR'], dataState: 'HOURLY_ALL', rowLimit: 48 }),
  })
  if (!res.ok) throw new Error(`GSC 24h ${res.status}`)
  const rows = ((await res.json()) as { rows?: GscApiRow[] }).rows ?? []
  const last24 = [...rows].sort((a, b) => ((a.keys?.[0] ?? '') < (b.keys?.[0] ?? '') ? -1 : 1)).slice(-24)
  const clicks = last24.reduce((s, r) => s + r.clicks, 0)
  const impressions = last24.reduce((s, r) => s + r.impressions, 0)
  const position = impressions ? last24.reduce((s, r) => s + r.position * r.impressions, 0) / impressions : 0
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position }
}

async function gscAggregate(token: string, startDate: string, endDate: string): Promise<GscWindow> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, dimensions: [] }),
  })
  if (!res.ok) throw new Error(`GSC agg ${res.status}: ${(await res.text()).slice(0, 140)}`)
  const row = ((await res.json()) as { rows?: GscApiRow[] }).rows?.[0]
  return row
    ? { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }
    : { clicks: 0, impressions: 0, ctr: 0, position: 0 }
}

async function gscSeries(token: string, startDate: string, endDate: string): Promise<{ date: string; clicks: number }[]> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, dimensions: ['date'], rowLimit: 40 }),
  })
  if (!res.ok) return []
  const rows = ((await res.json()) as { rows?: GscApiRow[] }).rows ?? []
  return rows.map((r) => ({ date: r.keys?.[0] ?? '', clicks: r.clicks })).filter((d) => d.date)
}

export async function getSearchTotals(): Promise<SearchTotals> {
  let token: string | null
  try {
    token = (await getOauthAccessToken()) ?? (await getServiceAccountToken([WEBMASTERS_SCOPE]))
  } catch (e) {
    return { available: false, note: `auth GSC: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!token) return { available: false, note: 'Google sin configurar' }

  try {
    const start28 = ymd(28), start7 = ymd(7), end = ymd(1)
    const [d28, d7, series, h24] = await Promise.all([
      gscAggregate(token, start28, end),
      gscAggregate(token, start7, end),
      gscSeries(token, start28, end),
      gscHourly24(token).catch(() => undefined),
    ])
    return { available: true, h24, d28, d7, series, rangeStart: start28, rangeEnd: end }
  } catch (e) {
    return { available: false, note: e instanceof Error ? e.message : String(e) }
  }
}

// ── GA4 Realtime — quién está EN VIVO (últimos 30 min): cuántos, de dónde, dónde ─

export interface RealtimeGeo { country: string; countryCode: string; city: string; users: number }
export interface RealtimePage { page: string; users: number }
export interface Ga4Realtime {
  available: boolean
  activeUsers: number
  byLocation?: RealtimeGeo[]
  byPage?: RealtimePage[]
  note?: string
}

async function ga4RealtimeReport(token: string, body: Record<string, unknown>): Promise<Ga4Row[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runRealtimeReport`
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GA4 realtime ${res.status}: ${(await res.text()).slice(0, 140)}`)
  return ((await res.json()) as { rows?: Ga4Row[] }).rows ?? []
}

export async function getGa4Realtime(): Promise<Ga4Realtime> {
  let token: string | null = null
  try {
    token = (await getServiceAccountToken([ANALYTICS_SCOPE])) ?? (await getOauthAccessToken())
  } catch (e) {
    return { available: false, activeUsers: 0, note: `auth: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!token) return { available: false, activeUsers: 0, note: 'Sin service account de Google' }

  try {
    const [totalRows, locRows, pageRows] = await Promise.all([
      ga4RealtimeReport(token, { metrics: [{ name: 'activeUsers' }] }),
      ga4RealtimeReport(token, { dimensions: [{ name: 'country' }, { name: 'countryId' }, { name: 'city' }], metrics: [{ name: 'activeUsers' }], limit: 10 }),
      ga4RealtimeReport(token, { dimensions: [{ name: 'unifiedScreenName' }], metrics: [{ name: 'activeUsers' }], limit: 10 }),
    ])
    const activeUsers = Number(totalRows[0]?.metricValues?.[0]?.value ?? 0)
    const byLocation = locRows
      .map((r) => ({ country: r.dimensionValues?.[0]?.value ?? '', countryCode: r.dimensionValues?.[1]?.value ?? '', city: r.dimensionValues?.[2]?.value ?? '', users: Number(r.metricValues?.[0]?.value ?? 0) }))
      .filter((l) => l.users > 0)
    const byPage = pageRows
      .map((r) => ({ page: r.dimensionValues?.[0]?.value ?? '', users: Number(r.metricValues?.[0]?.value ?? 0) }))
      .filter((p) => p.users > 0)
    return { available: true, activeUsers, byLocation, byPage }
  } catch (e) {
    return { available: false, activeUsers: 0, note: e instanceof Error ? e.message : String(e) }
  }
}
