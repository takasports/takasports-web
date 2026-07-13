'use client'

// Explorador por periodo: pills (24h / 7 días / Mes / Total) que cambian la
// ventana de las métricas clave (visitas, clics, apariciones), con % vs el
// periodo anterior. Recibe TODOS los periodos pre-calculados del server.

import { useState } from 'react'

export interface PeriodMetric {
  visits: number | null
  visitsPrev: number | null
  clics: number | null
  clicsPrev: number | null
  impressions: number | null
  impressionsPrev: number | null
}
export interface PeriodData { key: string; label: string; metric: PeriodMetric }

const nf = (n?: number | null) => (n == null ? '–' : Math.round(n).toLocaleString('es-ES'))
function deltaPct(cur?: number | null, prev?: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null
  return Math.round(((cur - prev) / prev) * 100)
}

function Delta({ cur, prev }: { cur: number | null; prev: number | null }) {
  const d = deltaPct(cur, prev)
  if (d == null) return null
  const up = d >= 0
  return <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, color: up ? '#86EFAC' : '#FCA5A5' }}>{up ? '▲' : '▼'} {up ? '+' : ''}{d}%</span>
}

function Card({ icon, label, hint, value, accent }: { icon: string; label: string; hint: string; value: React.ReactNode; accent: string }) {
  return (
    <div className="tk-glass-tint tk-glass-spine" style={{ ['--ga' as string]: accent, borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }} title={hint}>
      <p className="section-label" style={{ marginBottom: 8 }}>{icon} {label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 4vw, 2.4rem)', fontWeight: 900, color: '#F8F8FF', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</p>
    </div>
  )
}

export default function PeriodExplorer({ periods }: { periods: PeriodData[] }) {
  const [sel, setSel] = useState<string>(periods.some((p) => p.key === 'month') ? 'month' : periods[0]?.key)
  const cur = periods.find((p) => p.key === sel) ?? periods[0]
  if (!cur) return null
  const m = cur.metric

  return (
    <section className="mb-8">
      {/* Pills */}
      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Periodo">
        {periods.map((p) => {
          const active = p.key === sel
          return (
            <button
              key={p.key}
              onClick={() => setSel(p.key)}
              role="tab"
              aria-selected={active}
              className={active ? '' : 'tk-glass'}
              style={{
                padding: '7px 16px',
                borderRadius: 'var(--radius-full)',
                fontFamily: 'var(--font-sport)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                color: active ? '#0b0b12' : 'var(--text-secondary)',
                background: active ? 'linear-gradient(135deg,#A78BFA,#7C3AED)' : undefined,
                border: active ? 'none' : undefined,
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Métricas del periodo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card icon="👥" label="Visitas" hint="Personas distintas que ENTRARON a la web en el periodo (usuarios activos de Google Analytics)." accent="#7C3AED"
          value={<>{nf(m.visits)}<Delta cur={m.visits} prev={m.visitsPrev} /></>} />
        <Card icon="🔍" label="Clics en Google" hint="Veces que alguien pinchó tu web en los resultados de búsqueda de Google (Search Console)." accent="#8B5CF6"
          value={<>{nf(m.clics)}<Delta cur={m.clics} prev={m.clicsPrev} /></>} />
        <Card icon="👁" label="Apariciones" hint="Veces que tu web SALIÓ en resultados de Google (aunque no pincharan). Search Console." accent="#F472B6"
          value={<>{nf(m.impressions)}<Delta cur={m.impressions} prev={m.impressionsPrev} /></>} />
      </div>
      <p style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 10 }}>
        ▲▼ = cambio vs el periodo anterior · pasa el cursor por cada tarjeta para ver qué mide
      </p>
    </section>
  )
}
