// /admin/trafico
// Panel ÚNICO de tráfico. Junta en una pantalla lo que antes estaba disperso en
// varios sitios (GA4, Search Console, salud web) para que no haya que saltar de
// panel en panel. Cada bloque mide algo distinto — el explicador de arriba lo
// aclara para evitar el "¿por qué no cuadran los números?".
//
//   • Visitas reales (GA4 Data API)      → gente que ENTRA a la web
//   • Búsqueda en Google (Search Console)→ apariciones y clics EN Google
//   • Descargas app iOS (App Store)      → pendiente de conectar aquí
//   • Salud web (deploy + rutas)         → que todo responda
//
// Protección: misma allowlist de admin que el resto de /admin.
// Degradación elegante: si a un bloque le falta credencial, muestra "pendiente"
// con los pasos para activarlo, en vez de romper la página.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { getGa4Summary, type Ga4Summary } from '@/lib/traffic'
import {
  getTrafficSummary,
  checkRoutes,
  checkVercelDeploy,
  type TrafficSummary,
  type RouteCheck,
  type DeployStatus,
} from '@/lib/seo-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Tráfico — TakaSports',
  robots: { index: false, follow: false },
}

const nf = (n?: number | null) => (n == null ? '–' : Math.round(n).toLocaleString('es-ES'))
const pct = (ctr?: number | null) => (ctr == null ? '–' : `${(ctr * 100).toFixed(1).replace('.', ',')}%`)

function TrendChip({ trend }: { trend?: 'up' | 'down' | 'flat' }) {
  if (!trend) return null
  const map = { up: { t: '▲', c: '#86EFAC' }, down: { t: '▼', c: '#FCA5A5' }, flat: { t: '▶', c: 'var(--text-muted)' } }
  const { t, c } = map[trend]
  return <span style={{ color: c, fontSize: 13, fontWeight: 800, marginLeft: 8 }}>{t}</span>
}

function BigCard({
  label, value, sub, accent = 'var(--purple)', children,
}: { label: string; value: ReactNode; sub?: ReactNode; accent?: string; children?: ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `3px solid ${accent}`, borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
      <p className="section-label" style={{ marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, color: '#F8F8FF', lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {sub && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>{sub}</p>}
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="section-accent" />
      <h2 className="section-label">{children}</h2>
    </div>
  )
}

/** Barritas de la serie diaria de usuarios (últimos ~8 días). */
function Sparkbars({ series }: { series: { date: string; users: number }[] }) {
  if (!series.length) return null
  const max = Math.max(...series.map((d) => d.users), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48, marginTop: 14 }}>
      {series.map((d) => {
        const h = Math.max(3, Math.round((d.users / max) * 46))
        const day = d.date.slice(8, 10)
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div title={`${d.date}: ${d.users}`} style={{ width: '100%', height: h, background: 'var(--purple)', borderRadius: 3, opacity: 0.85 }} />
            <span style={{ fontSize: 9, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{day}</span>
          </div>
        )
      })}
    </div>
  )
}

function PendingCard({ title, steps }: { title: string; steps: ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
      <p style={{ fontFamily: 'var(--font-sport)', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>
        ⚪️ {title}
      </p>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>{steps}</div>
    </div>
  )
}

export default async function TraficoPage() {
  await requireAdmin('/admin/trafico')

  const [ga4, gsc, routes, deploy]: [Ga4Summary, TrafficSummary, RouteCheck[], DeployStatus] = await Promise.all([
    getGa4Summary(),
    getTrafficSummary(),
    checkRoutes(),
    checkVercelDeploy(),
  ])

  const okCount = routes.filter((r) => r.ok).length

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 xl:px-10 pt-10 pb-24">

        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/dashboard" style={{ fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Dashboard editorial
          </Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, color: '#F8F8FF', letterSpacing: '-0.02em', marginTop: 8 }}>
            Tráfico
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
            Todo en un sitio. Datos en vivo · {new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}.
          </p>
        </div>

        {/* Explicador — por qué los números no coinciden entre bloques */}
        <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 32, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <b style={{ color: 'var(--text-primary)' }}>Cada bloque mide algo distinto</b> — es normal que los números no coincidan:
          <b> Visitas (GA4)</b> = personas que entran a la web · <b>Búsqueda (Search Console)</b> = apariciones y clics en Google ·
          <b> Descargas</b> = instalaciones de la app iOS.
        </div>

        {/* ── VISITAS REALES · GA4 ── */}
        <section className="mb-10">
          <SectionTitle>Visitas reales · Google Analytics</SectionTitle>
          {ga4.available ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <BigCard label="Usuarios · ayer" value={<>{nf(ga4.yesterday)}<TrendChip trend={ga4.trend} /></>} sub={`anteayer ${nf(ga4.dayBefore)}`} accent="#7C3AED">
                {ga4.series && <Sparkbars series={ga4.series} />}
              </BigCard>
              <BigCard label="Media · 7 días" value={nf(ga4.avg7)} sub="usuarios activos/día" accent="#8B5CF6" />
              <BigCard label="Orgánico · 7d" value={ga4.organicPct == null ? '–' : `${ga4.organicPct}%`} sub="llega desde búsqueda de Google" accent="#F472B6" />
              <BigCard label="Propiedad GA4" value={<span style={{ fontSize: '1rem', fontFamily: 'var(--font-sport)' }}>{ga4.propertyId}</span>} sub={ga4.measurementId ? `tag ${ga4.measurementId}` : undefined} accent="#60A5FA" />
            </div>
          ) : (
            <PendingCard
              title="GA4 pendiente de conectar"
              steps={
                <>
                  {ga4.note && <p style={{ marginBottom: 8 }}>Motivo: <code style={{ fontSize: 12 }}>{ga4.note}</code></p>}
                  Para encender las visitas: re-genera el <b>refresh token OAuth</b> añadiendo el scope{' '}
                  <code style={{ fontSize: 12 }}>analytics.readonly</code> (además del de Search Console que ya tiene), en OAuth Playground,
                  y actualiza <code style={{ fontSize: 12 }}>GOOGLE_OAUTH_REFRESH_TOKEN</code>. Verifica también que la propiedad{' '}
                  <b>{ga4.propertyId}</b> es la del tag <b>{ga4.measurementId ?? 'G-…'}</b> (GA4 → Admin → Flujos de datos).
                </>
              }
            />
          )}
        </section>

        {/* ── BÚSQUEDA EN GOOGLE · SEARCH CONSOLE ── */}
        <section className="mb-10">
          <SectionTitle>Búsqueda en Google · Search Console</SectionTitle>
          {gsc.available && gsc.lastDay ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <BigCard label="Apariciones" value={nf(gsc.impressions)} sub={`media 7d ${nf(gsc.avgImpressions7)}`} accent="#7C3AED" />
                <BigCard label="Clics" value={<>{nf(gsc.clicks)}<TrendChip trend={gsc.clicksTrend} /></>} sub={`media 7d ${nf(gsc.avgClicks7)}`} accent="#8B5CF6" />
                <BigCard label="Entran de cada 100" value={pct(gsc.ctr)} sub={`media 7d ${pct(gsc.avgCtr7)}`} accent="#F472B6" />
                <BigCard label="Puesto medio" value={gsc.position?.toFixed(1) ?? '–'} sub={`media 7d ${gsc.avgPosition7?.toFixed(1) ?? '–'}`} accent="#60A5FA" />
              </div>
              {gsc.topMovers && gsc.topMovers.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p className="section-label" style={{ marginBottom: 8 }}>🔥 Despegando</p>
                  <div className="flex flex-wrap gap-2">
                    {gsc.topMovers.map((m) => (
                      <span key={m.query} style={{ padding: '6px 12px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sport)', fontSize: 12, fontWeight: 600 }}>
                        {m.query} <span style={{ color: '#86EFAC', fontWeight: 700 }}>+{nf(m.delta)}</span> {m.isNew && <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>🆕</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {gsc.opportunity && (
                <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  💡 <b>Tarea:</b> &quot;{gsc.opportunity.query}&quot; te ve {nf(gsc.opportunity.impressions)} veces pero casi nadie entra ({pct(gsc.opportunity.ctr)}) → mejora su título en Sanity.
                </p>
              )}
            </>
          ) : (
            <PendingCard title="Search Console sin datos" steps={gsc.note ?? 'Google tarda 2-3 días en tener datos.'} />
          )}
        </section>

        {/* ── DESCARGAS APP iOS ── */}
        <section className="mb-10">
          <SectionTitle>Descargas app iOS</SectionTitle>
          <PendingCard
            title="App Store aún no conectada a este panel"
            steps={
              <>
                Las descargas se ven ahora en el <b>informe diario de Telegram</b> (taka-system, 9:15) y en{' '}
                <a href="https://appstoreconnect.apple.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)', textDecoration: 'underline' }}>App Store Connect</a>.
                Se pueden traer aquí con la Sales Reports API (la key .p8 ya existe en taka-system).
              </>
            }
          />
        </section>

        {/* ── SALUD WEB ── */}
        <section>
          <SectionTitle>Salud de la web</SectionTitle>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: routes.every((r) => r.ok) ? '#86EFAC' : '#FCA5A5', fontSize: 18 }}>
              {okCount}/{routes.length} páginas OK
              {deploy.available && <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 14 }}> · deploy {deploy.state}</span>}
            </p>
            <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
              {routes.map((r) => (
                <span key={r.path} style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-sport)', color: r.ok ? 'var(--text-secondary)' : '#FCA5A5' }}>
                  {r.ok ? '✓' : '✕'} {r.path} <span style={{ color: 'var(--text-faint)' }}>{r.status ?? 'timeout'}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
