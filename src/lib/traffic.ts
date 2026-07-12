// Visitas reales de la web — GA4 Data API (usuarios activos por día + canal).
//
// Complementa a `@/lib/seo-audit` (que cubre Search Console): mientras GSC mide
// apariciones/clics EN Google, esto mide la gente que de verdad ENTRA a la web.
// Son números distintos a propósito — ver /admin/trafico para el contexto.
//
// Auth: reutiliza el mismo token OAuth de usuario que GSC. OJO: el scope lo fija
// el refresh token al crearse. Si no incluye `analytics.readonly`, la Data API
// responde 403 y este módulo degrada con elegancia (available:false + nota),
// igual que hace seo-audit. En cuanto el token tenga el scope, se enciende solo.

import { getOauthAccessToken } from './seo-audit'

// Propiedad GA4 numérica (la Data API usa el ID numérico, no el "G-…").
// Por defecto la propiedad "Deportes" (la misma que lee el informe de taka-system).
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '478319346'
// ID de medición del tag del sitio (para verificar que la propiedad coincide).
const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || null

const FETCH_TIMEOUT_MS = 10_000

export interface Ga4Day {
  date: string // YYYY-MM-DD
  users: number
}

export interface Ga4Summary {
  available: boolean
  propertyId: string
  measurementId: string | null
  series?: Ga4Day[] // últimos ~8 días, orden ascendente
  yesterday?: number
  dayBefore?: number
  avg7?: number
  organicPct?: number // % de usuarios de "Organic Search" en 7d
  trend?: 'up' | 'down' | 'flat'
  note?: string
}

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

interface Ga4Row {
  dimensionValues?: { value?: string }[]
  metricValues?: { value?: string }[]
}

async function runReport(token: string, body: Record<string, unknown>): Promise<Ga4Row[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200)
    // 403 casi siempre = el token no tiene scope analytics.readonly o el usuario
    // no está añadido a la propiedad GA4. Mensaje accionable en vez de críptico.
    if (res.status === 403) {
      throw new Error(
        `GA4 403: falta el scope analytics.readonly en el token OAuth, o el usuario no tiene acceso a la propiedad ${GA4_PROPERTY_ID}`,
      )
    }
    throw new Error(`GA4 runReport ${res.status}: ${detail}`)
  }
  const data = (await res.json()) as { rows?: Ga4Row[] }
  return data.rows ?? []
}

/** Formatea "20260712" (GA4) → "2026-07-12". */
function fmtGaDate(s: string): string {
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s
}

export async function getGa4Summary(): Promise<Ga4Summary> {
  const baseline: Ga4Summary = {
    available: false,
    propertyId: GA4_PROPERTY_ID,
    measurementId: GA4_MEASUREMENT_ID,
  }

  let token: string | null
  try {
    token = await getOauthAccessToken()
  } catch (e) {
    return { ...baseline, note: `auth GA4: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!token) return { ...baseline, note: 'Google sin configurar (OAuth)' }

  try {
    // 1) Usuarios activos por día — últimos 8 días completos (hasta ayer).
    const daily = await runReport(token, {
      dateRanges: [{ startDate: '8daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    })

    const series: Ga4Day[] = daily
      .map((r) => ({
        date: fmtGaDate(r.dimensionValues?.[0]?.value ?? ''),
        users: Number(r.metricValues?.[0]?.value ?? 0),
      }))
      .filter((d) => d.date)

    if (!series.length) {
      return { ...baseline, available: true, series: [], note: 'sin datos de GA4 en el periodo' }
    }

    const yesterday = series[series.length - 1]?.users ?? 0
    const dayBefore = series.length >= 2 ? series[series.length - 2].users : 0
    const avg7 = mean(series.slice(-7).map((d) => d.users))

    // 2) Reparto por canal (7d) para el % de tráfico orgánico de búsqueda.
    let organicPct: number | undefined
    try {
      const byChannel = await runReport(token, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'activeUsers' }],
      })
      let total = 0
      let organic = 0
      for (const r of byChannel) {
        const ch = r.dimensionValues?.[0]?.value ?? ''
        const u = Number(r.metricValues?.[0]?.value ?? 0)
        total += u
        if (ch === 'Organic Search') organic += u
      }
      if (total > 0) organicPct = Math.round((organic / total) * 100)
    } catch {
      // el % de canal es secundario: si falla, seguimos sin él.
    }

    return {
      ...baseline,
      available: true,
      series,
      yesterday,
      dayBefore,
      avg7,
      organicPct,
      trend: trendOf(yesterday, avg7),
    }
  } catch (e) {
    return { ...baseline, note: e instanceof Error ? e.message : String(e) }
  }
}
