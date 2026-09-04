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
import { sanityClient } from './sanity'

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '478319346' // propiedad "Deportes" (WEB)
const GA4_APP_PROPERTY_ID = process.env.GA4_APP_PROPERTY_ID || '547400035' // propiedad "taka-eef70" (APP iOS)
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
  prevTotal28?: number // usuarios de los 28 días ANTERIORES (para el % de cambio)
  users7d?: number
  prevUsers7d?: number
  allTimeUsers?: number // usuarios de todo el histórico (opción "Total")
  sessions28?: number
  newUsers28?: number
  pagesPerSession?: number
  avgSessionSec?: number
  engagementRate?: number // 0..1
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

async function ga4RunReport(token: string, propertyId: string, body: Record<string, unknown>): Promise<Ga4Row[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200)
    if (res.status === 403) {
      throw new Error(
        `GA4 403: la credencial no tiene acceso a la propiedad ${propertyId} (o falta el scope analytics.readonly)`,
      )
    }
    throw new Error(`GA4 runReport ${res.status}: ${detail}`)
  }
  const data = (await res.json()) as { rows?: Ga4Row[] }
  return data.rows ?? []
}

/** Resumen web por defecto; pásale `GA4_APP_PROPERTY_ID` + 'unifiedScreenName' para la app. */
export async function getGa4Summary(propertyId: string = GA4_PROPERTY_ID, screenDim = 'pagePath'): Promise<Ga4Summary> {
  const baseline: Ga4Summary = {
    available: false,
    propertyId,
    measurementId: propertyId === GA4_PROPERTY_ID ? GA4_MEASUREMENT_ID : null,
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
    const run = (body: Record<string, unknown>) => ga4RunReport(t, propertyId, body)
    const safe = async (fn: () => Promise<Ga4Row[]>): Promise<Ga4Row[] | undefined> => {
      try { return await fn() } catch { return undefined }
    }

    // Serie de 30 días (esencial) + enriquecimiento en paralelo (cada uno degrada).
    const [daily, channelsRes, pagesRes, devicesRes, countriesRes, totalsRes, prevRes, allTimeRes] = await Promise.all([
      run({
        dateRanges: [{ startDate: '29daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      safe(() => run({
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      })),
      safe(() => run({
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: screenDim }], metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 8,
      })),
      safe(() => run({
        dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      })),
      safe(() => run({
        dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'country' }, { name: 'countryId' }], metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8,
      })),
      safe(() => run({
        dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'newUsers' }, { name: 'screenPageViewsPerSession' }, { name: 'averageSessionDuration' }, { name: 'engagementRate' }],
      })),
      safe(() => run({
        dateRanges: [{ startDate: '56daysAgo', endDate: '29daysAgo' }],
        metrics: [{ name: 'activeUsers' }],
      })),
      safe(() => run({
        dateRanges: [{ startDate: '2020-01-01', endDate: 'today' }],
        metrics: [{ name: 'activeUsers' }],
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
    // Totales: si la consulta CORRIÓ (aunque devuelva vacío = propiedad sin datos,
    // p.ej. la app antes de publicar), los usuarios son 0 (no "–"), para que las
    // tarjetas de cabecera salgan consistentes. La calidad (páginas/tiempo/interacción)
    // sí queda undefined cuando no hay filas → su sub-bloque se oculta.
    const tv = totalsRes?.[0]?.metricValues
    const total28 = totalsRes ? Number(tv?.[0]?.value ?? 0) : undefined
    const sessions28 = totalsRes ? Number(tv?.[1]?.value ?? 0) : undefined
    const newUsers28 = totalsRes ? Number(tv?.[2]?.value ?? 0) : undefined
    const pagesPerSession = tv ? Number(tv[3]?.value ?? 0) : undefined
    const avgSessionSec = tv ? Number(tv[4]?.value ?? 0) : undefined
    const engagementRate = tv ? Number(tv[5]?.value ?? 0) : undefined
    const prevTotal28 = prevRes ? Number(prevRes[0]?.metricValues?.[0]?.value ?? 0) : undefined
    const allTimeUsers = allTimeRes ? Number(allTimeRes[0]?.metricValues?.[0]?.value ?? 0) : undefined
    const users7d = series.length ? series.slice(-7).reduce((s, d) => s + d.users, 0) : undefined
    const prevUsers7d = series.length >= 14 ? series.slice(-14, -7).reduce((s, d) => s + d.users, 0) : undefined

    return {
      ...baseline, available: true, via, series, yesterday, dayBefore, avg7,
      total28, prevTotal28, users7d, prevUsers7d, allTimeUsers, sessions28, newUsers28,
      pagesPerSession, avgSessionSec, engagementRate, organicPct, trend: trendOf(yesterday, avg7),
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
  prev7d?: number // 7 días anteriores (para el % de cambio)
  total?: number
  launchDate?: string
  countries?: [string, number][] // acumulado desde el lanzamiento
  countries7d?: [string, number][] // últimos 7 días → de dónde son las últimas descargas
  note?: string
}

interface TrafficRowRaw {
  app?: { launchDate?: string; countries?: [string, number][]; countries7d?: [string, number][]; prev7?: number; pending?: boolean; error?: string; empty?: boolean }
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
    prev7d: app?.prev7,
    total: row.ios_downloads_total ?? undefined,
    launchDate: app?.launchDate,
    countries: app?.countries,
    countries7d: app?.countries7d,
  }
}

// ── Histórico unificado (desde Supabase traffic_daily) ────────────────────────
// Una fila por día (la escribe el informe diario). Da la serie temporal de las
// tres métricas juntas. Bases distintas por métrica (etiquetadas en la UI):
// visitas = del día · clics = ventana 7d · descargas = total acumulado.

export interface TrafficHistoryDay {
  day: string
  visits: number | null
  clics: number | null
  downloads: number | null
}

export async function getTrafficHistory(days = 30): Promise<TrafficHistoryDay[]> {
  const supa = adminSupabase()
  if (!supa) return []
  const { data, error } = await supa
    .from('traffic_daily')
    .select('day, ga_users_yesterday, gsc_clicks, ios_downloads_total')
    .order('day', { ascending: false })
    .limit(days)
  if (error || !Array.isArray(data)) return []
  return (data as { day: string; ga_users_yesterday: number | null; gsc_clicks: number | null; ios_downloads_total: number | null }[])
    .map((r) => ({ day: r.day, visits: r.ga_users_yesterday, clics: r.gsc_clicks, downloads: r.ios_downloads_total }))
    .reverse() // ascendente para la gráfica
}

// La cobertura de medición (cuánto NO vemos por el consentimiento) vive aparte,
// en `traffic-cobertura.ts`: es lógica pura y así se puede probar sin arrastrar
// el cliente de Sanity, que este módulo importa y que exige envs al importarse.
export { coberturaDeMedicion, type CoberturaMedicion } from './traffic-cobertura'

// ── Search Console: totales por VENTANA (28d / 7d) ────────────────────────────
// Antes el panel mostraba UN día suelto → parecía "mal" frente a la UI de Search
// Console, que muestra rangos (28 días, 3 meses…). Esto da totales claros que
// cuadran con lo que ve el usuario en Google.

export interface GscWindow { clicks: number; impressions: number; ctr: number; position: number }
export interface SearchTotals {
  available: boolean
  h24?: GscWindow
  d28?: GscWindow
  prevD28?: GscWindow // 28 días anteriores (para el % de cambio)
  d7?: GscWindow
  prevD7?: GscWindow
  allTime?: GscWindow // ~16 meses (máximo de Search Console) → opción "Total"
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
    const [d28, d7, series, h24, prevD28, prevD7, allTime] = await Promise.all([
      gscAggregate(token, start28, end),
      gscAggregate(token, start7, end),
      gscSeries(token, start28, end),
      gscHourly24(token).catch(() => undefined),
      gscAggregate(token, ymd(56), ymd(29)).catch(() => undefined),
      gscAggregate(token, ymd(14), ymd(8)).catch(() => undefined),
      gscAggregate(token, ymd(480), ymd(1)).catch(() => undefined),
    ])
    return { available: true, h24, d28, prevD28, d7, prevD7, allTime, series, rangeStart: start28, rangeEnd: end }
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

async function ga4RealtimeReport(token: string, propertyId: string, body: Record<string, unknown>): Promise<Ga4Row[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GA4 realtime ${res.status}: ${(await res.text()).slice(0, 140)}`)
  return ((await res.json()) as { rows?: Ga4Row[] }).rows ?? []
}

/** Tiempo real web por defecto; pásale `GA4_APP_PROPERTY_ID` para la app. */
export async function getGa4Realtime(propertyId: string = GA4_PROPERTY_ID): Promise<Ga4Realtime> {
  let token: string | null = null
  try {
    token = (await getServiceAccountToken([ANALYTICS_SCOPE])) ?? (await getOauthAccessToken())
  } catch (e) {
    return { available: false, activeUsers: 0, note: `auth: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!token) return { available: false, activeUsers: 0, note: 'Sin service account de Google' }

  try {
    const tk = token
    const rt = (body: Record<string, unknown>) => ga4RealtimeReport(tk, propertyId, body)
    const [totalRows, locRows, pageRows] = await Promise.all([
      rt({ metrics: [{ name: 'activeUsers' }] }),
      rt({ dimensions: [{ name: 'country' }, { name: 'countryId' }, { name: 'city' }], metrics: [{ name: 'activeUsers' }], limit: 10 }),
      rt({ dimensions: [{ name: 'unifiedScreenName' }], metrics: [{ name: 'activeUsers' }], limit: 10 }),
    ])
    const activeUsers = Number(totalRows[0]?.metricValues?.[0]?.value ?? 0)
    // GA4 devuelve "(other)" para país/ciudad/pantalla cuando hay poca gente
    // (anonimización por privacidad) → lo descartamos para no pintar basura.
    const notOther = (s: string) => s && s !== '(other)'
    const byLocation = locRows
      .map((r) => ({ country: r.dimensionValues?.[0]?.value ?? '', countryCode: r.dimensionValues?.[1]?.value ?? '', city: r.dimensionValues?.[2]?.value ?? '', users: Number(r.metricValues?.[0]?.value ?? 0) }))
      .filter((l) => l.users > 0 && notOther(l.country))
    const byPage = pageRows
      .map((r) => ({ page: r.dimensionValues?.[0]?.value ?? '', users: Number(r.metricValues?.[0]?.value ?? 0) }))
      .filter((p) => p.users > 0 && notOther(p.page))
    return { available: true, activeUsers, byLocation, byPage }
  } catch (e) {
    return { available: false, activeUsers: 0, note: e instanceof Error ? e.message : String(e) }
  }
}

// ── Atajos de la APP (propiedad GA4 taka-eef70). La app usa `unifiedScreenName`
// (nombre de pantalla) en vez de `pagePath`. Sin datos hasta publicar la app.
export const getAppGa4Summary = () => getGa4Summary(GA4_APP_PROPERTY_ID, 'unifiedScreenName')
export const getAppGa4Realtime = () => getGa4Realtime(GA4_APP_PROPERTY_ID)

// ── Usuarios por país en 3 ventanas (para el tooltip del mapamundi) ───────────
export interface CountryWindow { country: string; countryCode: string; h24: number; d7: number; d28: number }

export async function getWebCountriesByWindow(): Promise<CountryWindow[]> {
  let token: string | null = null
  try {
    token = (await getServiceAccountToken([ANALYTICS_SCOPE])) ?? (await getOauthAccessToken())
  } catch { return [] }
  if (!token) return []
  const t = token
  const q = (start: string, end: string) =>
    ga4RunReport(t, GA4_PROPERTY_ID, {
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: 'country' }, { name: 'countryId' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 60,
    }).catch(() => [] as Ga4Row[])

  try {
    const [r24, r7, r28] = await Promise.all([q('yesterday', 'yesterday'), q('7daysAgo', 'yesterday'), q('28daysAgo', 'yesterday')])
    const map = new Map<string, CountryWindow>()
    const add = (rows: Ga4Row[], key: 'h24' | 'd7' | 'd28') => {
      for (const r of rows) {
        const country = r.dimensionValues?.[0]?.value ?? ''
        const code = r.dimensionValues?.[1]?.value ?? ''
        if (!code || code === '(other)') continue
        const u = Number(r.metricValues?.[0]?.value ?? 0)
        const cur = map.get(code) ?? { country, countryCode: code, h24: 0, d7: 0, d28: 0 }
        cur[key] = u
        if (!cur.country) cur.country = country
        map.set(code, cur)
      }
    }
    add(r24, 'h24'); add(r7, 'd7'); add(r28, 'd28')
    return [...map.values()].sort((a, b) => b.d28 - a.d28)
  } catch { return [] }
}

// ── Contenido que rinde: top ARTÍCULOS (por título vía Sanity) + engagement ────

export interface ContentItem { path: string; slug: string; title: string; views: number; avgSec: number }

export async function getTopContent(): Promise<ContentItem[]> {
  let token: string | null = null
  try {
    token = (await getServiceAccountToken([ANALYTICS_SCOPE])) ?? (await getOauthAccessToken())
  } catch { return [] }
  if (!token) return []

  try {
    const rows = await ga4RunReport(token, GA4_PROPERTY_ID, {
      dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'userEngagementDuration' }],
      dimensionFilter: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/noticias/' } } },
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    })
    const items: ContentItem[] = rows
      .map((r) => {
        const path = r.dimensionValues?.[0]?.value ?? ''
        const views = Number(r.metricValues?.[0]?.value ?? 0)
        const eng = Number(r.metricValues?.[1]?.value ?? 0)
        const slug = path.replace(/^\/noticias\//, '').split('?')[0].replace(/\/$/, '')
        return { path, slug, title: slug.replace(/-/g, ' '), views, avgSec: views ? Math.round(eng / views) : 0 }
      })
      .filter((i) => i.slug)

    // Título real desde Sanity (cae al slug legible si falla).
    try {
      const slugs = items.map((i) => i.slug)
      const docs = await sanityClient.fetch<{ slug: string; title: string }[]>(
        `*[_type=="article" && slug.current in $slugs]{ "slug": slug.current, title }`,
        { slugs },
      )
      const map = new Map((docs ?? []).map((d) => [d.slug, d.title]))
      for (const it of items) it.title = map.get(it.slug) ?? it.title
    } catch {
      /* Sanity opcional: dejamos el slug legible */
    }
    return items
  } catch {
    return []
  }
}

// ── Compartir noticias ────────────────────────────────────────────────────────
//
// Mide el evento `article_share`, que mandan la web (menú, bloques y flotante)
// y la app (hoja de compartir). Viven en propiedades de GA4 DISTINTAS —"Deportes"
// para la web y "taka-eef70" para la app— así que se piden por separado y se
// suman aquí.
//
// El desglose por método (historia / enlace / WhatsApp / X…) necesita que
// `method` esté registrado como DIMENSIÓN PERSONALIZADA en GA4; sin registrar,
// la Data API rechaza la consulta. Por eso va aparte y degrada con una nota que
// explica cómo encenderlo, en vez de tumbar la sección entera.
//
// Qué artículos se comparten sale de `pagePath`, que es dimensión estándar y
// funciona sin configurar nada. La app no tiene pagePath (manda `slug` como
// parámetro), así que la lista es de web; su total sí se suma.

export interface SharedArticle { path: string; slug: string; title: string; count: number }

export interface SharesSummary {
  available: boolean
  total28: number
  web28: number
  app28: number
  byMethod: { method: string; count: number }[] | null
  /** Por qué no hay desglose por método, si no lo hay. */
  methodNote?: string
  articles: SharedArticle[]
  note?: string
}

const SHARE_METHOD_LABEL: Record<string, string> = {
  story:    'En historia',
  native:   'Hoja del sistema',
  link:     'Enlace (app)',
  whatsapp: 'WhatsApp',
  x:        'X',
  facebook: 'Facebook',
  copy:     'Copiar enlace',
}

export function shareMethodLabel(m: string): string {
  return SHARE_METHOD_LABEL[m] ?? m
}

async function shareCount(token: string, propertyId: string): Promise<number> {
  const rows = await ga4RunReport(token, propertyId, {
    dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'article_share' } } },
  })
  return Number(rows[0]?.metricValues?.[0]?.value ?? 0)
}

export async function getShares(): Promise<SharesSummary> {
  const empty: SharesSummary = { available: false, total28: 0, web28: 0, app28: 0, byMethod: null, articles: [] }

  let token: string | null = null
  try {
    token = (await getServiceAccountToken([ANALYTICS_SCOPE])) ?? (await getOauthAccessToken())
  } catch (e) {
    return { ...empty, note: `auth GA4: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!token) return { ...empty, note: 'Sin service account de Google configurada (GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY)' }
  const t = token

  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn() } catch { return fallback }
  }

  // El total de web es ESENCIAL: si falla (403 por scope, propiedad sin acceso…)
  // hay que decir que no se pudo leer. Devolver "0 compartidas" sería mentir,
  // porque en el panel se lee igual que "nadie ha compartido".
  let web28: number
  try {
    web28 = await shareCount(t, GA4_PROPERTY_ID)
  } catch (e) {
    return { ...empty, note: e instanceof Error ? e.message : String(e) }
  }

  // El resto SÍ degrada: la app puede no tener datos todavía y el desglose por
  // método depende de una dimensión que quizá no esté registrada.
  const [app28, articleRows, methodRows] = await Promise.all([
    safe(() => shareCount(t, GA4_APP_PROPERTY_ID), 0),
    safe(() => ga4RunReport(t, GA4_PROPERTY_ID, {
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'article_share' } } },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 12,
    }), []),
    // `customEvent:method` peta si la dimensión no está registrada → null, no error.
    safe(() => ga4RunReport(t, GA4_PROPERTY_ID, {
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'customEvent:method' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'article_share' } } },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 10,
    }).then((r) => r as Ga4Row[] | null), null),
  ])

  const articles: SharedArticle[] = articleRows
    .map((r) => {
      const path = r.dimensionValues?.[0]?.value ?? ''
      const count = Number(r.metricValues?.[0]?.value ?? 0)
      const slug = path.replace(/^\/noticias\//, '').split('?')[0].replace(/\/$/, '')
      return { path, slug, title: slug.replace(/-/g, ' '), count }
    })
    .filter((a) => a.slug && a.path.includes('/noticias/'))

  // Título real desde Sanity, igual que en "Contenido que rinde".
  if (articles.length) {
    try {
      const docs = await sanityClient.fetch<{ slug: string; title: string }[]>(
        `*[_type=="article" && slug.current in $slugs]{ "slug": slug.current, title }`,
        { slugs: articles.map((a) => a.slug) },
      )
      const map = new Map((docs ?? []).map((d) => [d.slug, d.title]))
      for (const a of articles) a.title = map.get(a.slug) ?? a.title
    } catch { /* el slug legible sirve */ }
  }

  const byMethod = methodRows
    ? methodRows
        .map((r) => ({ method: r.dimensionValues?.[0]?.value ?? '', count: Number(r.metricValues?.[0]?.value ?? 0) }))
        .filter((m) => m.method && m.method !== '(not set)')
    : null

  return {
    available: true,
    total28: web28 + app28,
    web28,
    app28,
    byMethod: byMethod && byMethod.length ? byMethod : null,
    methodNote: byMethod === null
      ? 'Para ver el desglose por método hay que registrar `method` como dimensión personalizada en GA4 (Administrar → Definiciones personalizadas → Crear, ámbito de evento, parámetro `method`). Solo cuenta desde que se cree.'
      : undefined,
    articles,
  }
}

// ── Audiencia y retención: % que vuelve (GA4) + suscriptores/registros (Supabase) ─

export interface Audience {
  available: boolean
  returningPct?: number
  newUsers28?: number
  returningUsers28?: number
  pushTotal?: number
  pushNew7?: number
  newsletterTotal?: number
  newsletterNew7?: number
  profilesTotal?: number
  profilesNew7?: number
}

export async function getAudience(): Promise<Audience> {
  const out: Audience = { available: false }

  // GA4: nuevos vs recurrentes (28d)
  try {
    const token = (await getServiceAccountToken([ANALYTICS_SCOPE])) ?? (await getOauthAccessToken())
    if (token) {
      const rows = await ga4RunReport(token, GA4_PROPERTY_ID, {
        dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'newVsReturning' }],
        metrics: [{ name: 'activeUsers' }],
      })
      let nw = 0, ret = 0
      for (const r of rows) {
        const k = r.dimensionValues?.[0]?.value
        const u = Number(r.metricValues?.[0]?.value ?? 0)
        if (k === 'returning') ret += u
        else nw += u
      }
      const tot = nw + ret
      if (tot > 0) {
        out.available = true
        out.newUsers28 = nw
        out.returningUsers28 = ret
        out.returningPct = Math.round((ret / tot) * 100)
      }
    }
  } catch {
    /* GA4 opcional */
  }

  // Supabase: suscriptores push + newsletter + registros (total y nuevos 7d)
  const supa = adminSupabase()
  if (supa) {
    const since = ymd(7)
    const countOf = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0
    try {
      out.pushTotal = await countOf(supa.from('push_subscriptions').select('*', { count: 'exact', head: true }))
      out.pushNew7 = await countOf(supa.from('push_subscriptions').select('*', { count: 'exact', head: true }).gte('created_at', since))
      out.newsletterTotal = await countOf(supa.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).is('unsubscribed_at', null))
      out.newsletterNew7 = await countOf(supa.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).is('unsubscribed_at', null).gte('created_at', since))
      out.profilesTotal = await countOf(supa.from('profiles').select('*', { count: 'exact', head: true }))
      out.profilesNew7 = await countOf(supa.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since))
      out.available = true
    } catch {
      /* Supabase opcional */
    }
  }
  return out
}

// ── Zona de juegos ────────────────────────────────────────────────
//
// Por qué existe: en 90 días los minijuegos suman ~28 visitas al hub y 10
// aperturas de juego, mientras Predicciones tiene actividad diaria. Antes de
// seguir puliendo mecánicas hay que saber si el problema es el juego o que no
// llega nadie — y eso solo lo contesta GA4, que aquí (Vercel) sí tiene
// credencial de service account.

export interface GamesPage { path: string; views: number; users: number }
export interface GamesReferrer { from: string; views: number }
export interface GamesLanding { path: string; channel: string; sessions: number }
export interface GamesTraffic {
  available: boolean
  pages: GamesPage[]
  referrers: GamesReferrer[]
  landings: GamesLanding[]
}

/** Rutas que forman la zona de juegos. El hub primero. */
const GAME_PATHS = ['/juegos', '/crackquiz', '/takagrid', '/mionce', '/sopa-cracks'] as const

/** Referente crudo → etiqueta legible ("la propia web", "Google", el dominio…). */
function labelReferrer(raw: string): string {
  if (!raw) return 'Directo / sin referente'
  try {
    const u = new URL(raw)
    if (u.hostname.endsWith('takasportsmedia.com')) {
      return `Web propia · ${u.pathname === '/' ? 'portada' : u.pathname}`
    }
    return u.hostname.replace(/^www\./, '')
  } catch {
    return raw
  }
}

export async function getGamesTraffic(days = 90): Promise<GamesTraffic> {
  const vacio: GamesTraffic = { available: false, pages: [], referrers: [], landings: [] }

  let token: string | null = null
  try {
    token = (await getServiceAccountToken([ANALYTICS_SCOPE])) ?? (await getOauthAccessToken())
  } catch { return vacio }
  if (!token) return vacio

  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }]
  const enJuegos = (field: string) => ({
    orGroup: {
      expressions: GAME_PATHS.map(p => ({
        filter: { fieldName: field, stringFilter: { matchType: 'BEGINS_WITH', value: p } },
      })),
    },
  })

  try {
    const [pageRows, refRows, landRows] = await Promise.all([
      ga4RunReport(token, GA4_PROPERTY_ID, {
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
        dimensionFilter: enJuegos('pagePath'),
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 20,
      }),
      ga4RunReport(token, GA4_PROPERTY_ID, {
        dateRanges,
        dimensions: [{ name: 'pageReferrer' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/juegos' } },
        },
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 12,
      }),
      ga4RunReport(token, GA4_PROPERTY_ID, {
        dateRanges,
        dimensions: [{ name: 'landingPage' }, { name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: enJuegos('landingPage'),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 12,
      }),
    ])

    return {
      available: true,
      pages: pageRows.map(r => ({
        path:  r.dimensionValues?.[0]?.value ?? '',
        views: Number(r.metricValues?.[0]?.value ?? 0),
        users: Number(r.metricValues?.[1]?.value ?? 0),
      })).filter(p => p.path),
      referrers: refRows.map(r => ({
        from:  labelReferrer(r.dimensionValues?.[0]?.value ?? ''),
        views: Number(r.metricValues?.[0]?.value ?? 0),
      })),
      landings: landRows.map(r => ({
        path:     r.dimensionValues?.[0]?.value ?? '',
        channel:  r.dimensionValues?.[1]?.value ?? '—',
        sessions: Number(r.metricValues?.[0]?.value ?? 0),
      })),
    }
  } catch {
    return vacio
  }
}
