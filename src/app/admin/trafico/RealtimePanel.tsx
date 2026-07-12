'use client'

// Bloque "EN VIVO" de /admin/trafico: usuarios activos ahora (GA4 realtime),
// de dónde son y en qué página están. Recibe el primer dato del server y luego
// se auto-refresca cada 25s consultando /api/admin/trafico/realtime.

import { useEffect, useRef, useState } from 'react'
import type { Ga4Realtime } from '@/lib/traffic'

const REFRESH_MS = 25_000

function flag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '🌐'
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export default function RealtimePanel({ initial }: { initial: Ga4Realtime }) {
  const [rt, setRt] = useState<Ga4Realtime>(initial)
  const [beat, setBeat] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let alive = true
    async function tick() {
      try {
        const res = await fetch('/api/admin/trafico/realtime', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as Ga4Realtime
        if (!alive) return
        setRt(data)
        setUpdatedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
        setBeat(true)
        setTimeout(() => alive && setBeat(false), 900)
      } catch {
        /* silencioso: reintenta en el próximo tick */
      }
    }
    timer.current = setInterval(tick, REFRESH_MS)
    return () => {
      alive = false
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  const live = rt.available && rt.activeUsers > 0

  return (
    <section
      style={{
        background: live ? 'rgba(34,197,94,0.06)' : 'var(--bg-card)',
        border: `1px solid ${live ? 'rgba(34,197,94,0.35)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
        marginBottom: 32,
      }}
    >
      <style>{`@keyframes tk-pulse{0%{transform:scale(.85);opacity:1}70%{transform:scale(2.2);opacity:0}100%{opacity:0}}`}</style>

      {/* Cabecera */}
      <div className="flex items-center justify-between" style={{ marginBottom: live ? 18 : 0, flexWrap: 'wrap', gap: 8 }}>
        <div className="flex items-center gap-2.5">
          <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
            {live && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22C55E', animation: 'tk-pulse 1.6s ease-out infinite' }} />}
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: live ? '#22C55E' : 'var(--text-faint)', boxShadow: beat ? '0 0 0 6px rgba(34,197,94,0.25)' : 'none', transition: 'box-shadow .3s' }} />
          </span>
          <h2 className="section-label" style={{ color: live ? '#86EFAC' : 'var(--text-muted)' }}>En vivo · ahora mismo</h2>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          {rt.available ? `actualizado ${updatedAt || 'al cargar'} · cada 25s` : 'GA4 pendiente'}
        </span>
      </div>

      {!rt.available ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Se enciende cuando GA4 esté conectado{rt.note ? ` (${rt.note})` : ''}.
        </p>
      ) : !live ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: 'var(--font-sport)' }}>
          <b style={{ color: '#F8F8FF' }}>0</b> personas ahora mismo. En cuanto entre alguien, aparecerá aquí de dónde es y qué está viendo.
        </p>
      ) : (
        <div className="grid lg:grid-cols-[auto_1fr_1fr] gap-6" style={{ alignItems: 'start' }}>
          {/* Contador */}
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem,7vw,4rem)', fontWeight: 900, color: '#F8F8FF', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {rt.activeUsers}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              {rt.activeUsers === 1 ? 'persona en la web' : 'personas en la web'}
            </p>
          </div>

          {/* De dónde */}
          <div>
            <p className="section-label" style={{ marginBottom: 8 }}>De dónde</p>
            <div className="flex flex-col gap-1.5">
              {(rt.byLocation ?? []).slice(0, 6).map((l, i) => (
                <div key={i} className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span>{flag(l.countryCode)}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.city && l.city !== '(not set)' ? `${l.city}, ` : ''}{l.country}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F8F8FF' }}>{l.users}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Qué está viendo */}
          <div>
            <p className="section-label" style={{ marginBottom: 8 }}>Qué está viendo</p>
            <div className="flex flex-col gap-1.5">
              {(rt.byPage ?? []).slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.page}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F8F8FF' }}>{p.users}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
