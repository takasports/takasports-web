'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────
// Stats personales del Ranked
//
// Lee /api/quiniela/stats (autenticado). Muestra:
//   · ROI grande (verde positivo / rojo negativo / gris cero)
//   · Total apostado vs ganado
//   · Jornadas jugadas · % aciertos · racha actual
//   · Mejor jornada (con # de coins ganados)
//
// Si no hay auth o no hay datos todavía → renderiza nada (componente
// silencioso, no estorba a usuarios nuevos).
// ─────────────────────────────────────────────────────────────────

interface QuinielaStats {
  authed: boolean
  jornadasPlayed: number
  jornadasSettled: number
  totalStaked: number
  totalWon: number
  net: number
  roi: number | null
  totalHits: number
  totalPicks: number
  hitRate: number | null
  plenos: number
  currentStreak: number
  bestJornada: { jornada: string; won: number; hits: number; total: number } | null
}

export function PersonalStatsPanel({ user }: { user: User | null }) {
  const [stats, setStats] = useState<QuinielaStats | null>(null)

  useEffect(() => {
    if (!user) { setStats(null); return }
    let cancelled = false
    fetch('/api/quiniela/stats', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (!cancelled && json) setStats(json) })
      .catch(() => { /* silent */ })
    return () => { cancelled = true }
  }, [user])

  // Silent: sin user o sin jornadas jugadas el componente no aparece.
  // Usuarios nuevos no ven una card vacía deprimente — primero juegan.
  if (!user || !stats || !stats.authed || stats.jornadasPlayed === 0) return null

  const { roi, net, totalStaked, totalWon, jornadasPlayed, hitRate, currentStreak, bestJornada, plenos } = stats
  // Color del ROI según signo
  const roiColor = roi == null ? '#5A4878' : roi > 0 ? '#4ade80' : roi < 0 ? '#f87171' : '#9090A4'
  const roiBg = roi == null
    ? 'rgba(124,58,237,0.06)'
    : roi > 0
      ? 'rgba(34,197,94,0.08)'
      : roi < 0
        ? 'rgba(239,68,68,0.07)'
        : 'rgba(144,144,164,0.06)'
  const roiBorder = roi == null
    ? '1px solid rgba(124,58,237,0.18)'
    : roi > 0
      ? '1px solid rgba(34,197,94,0.22)'
      : roi < 0
        ? '1px solid rgba(239,68,68,0.22)'
        : '1px solid rgba(144,144,164,0.18)'

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="section-accent" />
        <h2 className="section-label">Tus stats</h2>
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
          {jornadasPlayed} jornada{jornadasPlayed !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ROI grande */}
      <div className="px-4 pt-4 pb-3">
        <div
          className="rounded-xl px-4 py-3 flex flex-col items-center text-center"
          style={{ background: roiBg, border: roiBorder }}
        >
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: roi == null ? '#5A4878' : '#5A7068', fontFamily: 'var(--font-sport)' }}>
            ROI
          </span>
          <span
            className="font-black tabular-nums leading-none"
            style={{ fontSize: 30, color: roiColor, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', marginTop: 4 }}
          >
            {roi == null ? '—' : roi > 0 ? `+${roi}%` : `${roi}%`}
          </span>
          <span className="text-[10px] tabular-nums mt-1.5" style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}>
            {totalStaked} pts apostado · {totalWon} pts ganado
          </span>
          {net !== 0 && (
            <span className="text-[9px] font-black tabular-nums mt-0.5" style={{ color: net > 0 ? '#4ade80' : '#f87171', fontFamily: 'var(--font-sport)' }}>
              {net > 0 ? `+${net}` : net} pts neto
            </span>
          )}
        </div>
      </div>

      {/* Mini stats: 3 columnas */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-1.5">
        <StatBox label="Aciertos" value={hitRate != null ? `${hitRate}%` : '—'} accent="#A78BFA" />
        <StatBox
          label={currentStreak > 0 ? '🔥 Racha' : 'Racha'}
          value={`${currentStreak}`}
          accent={currentStreak > 0 ? '#fb923c' : '#4A4A6A'}
        />
        <StatBox label="Plenos" value={`${plenos}`} accent="#fbbf24" />
      </div>

      {/* Mejor jornada */}
      {bestJornada && (
        <div className="mx-4 mb-4 rounded-xl px-3 py-2.5 flex items-center gap-2.5" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>🏆</span>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#6A5020', fontFamily: 'var(--font-sport)' }}>
              Mejor jornada
            </p>
            <p className="text-[11px] font-bold truncate" style={{ color: '#fbbf24', fontFamily: 'var(--font-display)' }}>
              {bestJornada.jornada}
            </p>
            <p className="text-[9px]" style={{ color: '#8A6B30', fontFamily: 'var(--font-sport)' }}>
              {bestJornada.hits}/{bestJornada.total} aciertos
            </p>
          </div>
          <span className="text-sm font-black tabular-nums flex-shrink-0" style={{ color: '#fbbf24', fontFamily: 'var(--font-display)' }}>
            +{bestJornada.won} pts
          </span>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className="rounded-lg px-2 py-2 flex flex-col items-center"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span className="font-black tabular-nums leading-none" style={{ fontSize: 16, color: accent, fontFamily: 'var(--font-display)' }}>
        {value}
      </span>
      <span className="text-[8px] font-black uppercase tracking-widest mt-1" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
        {label}
      </span>
    </div>
  )
}
