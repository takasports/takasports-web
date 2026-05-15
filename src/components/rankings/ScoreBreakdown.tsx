'use client'

import Link from 'next/link'
import type { RankingEntry } from '@/lib/rankings'
import { scoreColor } from '@/lib/rankings-ui'
import { PinIcon } from '@/components/icons/GameIcons'

const FACTOR_META = [
  { key: 'rendimiento', label: 'Rendimiento', pct: '40%', color: '#22c55e',
    desc: 'Stats reales (goles, asistencias, PPG, puntos, victorias…) y rating de equipo' },
  { key: 'contexto',    label: 'Contexto',    pct: '20%', color: '#60a5fa',
    desc: 'Nivel de la competición y posición del equipo en su liga' },
  { key: 'mediatico',   label: 'Mediático',   pct: '25%', color: '#f59e0b',
    desc: 'Alcance en redes, búsquedas y cobertura en prensa especializada' },
  { key: 'narrativa',   label: 'Narrativa',   pct: '15%', color: '#c084fc',
    desc: 'Momento de su carrera, hitos, polémicas y peso histórico' },
] as const

export default function ScoreBreakdown({
  entry,
  showProfileLink = true,
  compact = false,
}: {
  entry: RankingEntry
  showProfileLink?: boolean
  compact?: boolean
}) {
  if (!entry.factors) return null

  const base = Math.round((
    entry.factors.rendimiento * 0.40 +
    entry.factors.contexto    * 0.20 +
    entry.factors.mediatico   * 0.25 +
    entry.factors.narrativa   * 0.15
  ) * 10) / 10
  const boost = entry.editorialBoost ?? 0
  const total = Math.round(Math.max(0, Math.min(100, base + boost)) * 10) / 10

  return (
    <div className={compact ? 'pt-1' : 'pt-2'}>
      <p className="text-[8px] font-black uppercase tracking-[0.15em] mb-2"
        style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
        Desglose Índice Taka
      </p>

      <div className="flex flex-col gap-1.5">
        {FACTOR_META.map(({ key, label, pct, color, desc }) => {
          const val = entry.factors![key]
          return (
            <div key={key} className="group/factor relative flex items-center gap-2">
              <span className="text-[9px] w-[78px] flex-shrink-0 leading-none"
                style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                {label} <span style={{ color: '#3A3A4A' }}>{pct}</span>
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: color, opacity: 0.85 }} />
              </div>
              <span className="text-[10px] tabular-nums w-7 text-right flex-shrink-0 font-bold"
                style={{ color: '#9090AA', fontFamily: 'var(--font-display)' }}>
                {val}
              </span>
              {/* Tooltip explicativo del factor */}
              <div className="absolute left-[80px] bottom-full mb-1 w-56 px-2.5 py-1.5 rounded-lg pointer-events-none z-30
                opacity-0 group-hover/factor:opacity-100 transition-opacity duration-150"
                style={{ background: '#0F0F1A', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                <p className="text-[10px] leading-relaxed" style={{ color: '#A0A0B8', fontFamily: 'var(--font-sport)' }}>
                  {desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 pt-2 flex flex-col gap-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex justify-between items-center">
          <span className="text-[9px]" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
            Base objetiva (sin ajuste)
          </span>
          <span className="text-[10px] tabular-nums font-bold"
            style={{ color: '#7A7A92', fontFamily: 'var(--font-display)' }}>
            {base.toFixed(1)}
          </span>
        </div>
        {boost !== 0 && (
          <div className="flex justify-between items-start gap-2">
            <span className="text-[9px] leading-snug flex-1 inline-flex items-start gap-1.5"
              style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
              <span className="mt-0.5"><PinIcon size={10} /></span>
              <span>
                Ajuste editorial
                {entry.editorialNote && (
                  <span className="block italic mt-0.5" style={{ color: '#3A3A4A' }}>&ldquo;{entry.editorialNote}&rdquo;</span>
                )}
              </span>
            </span>
            <span className="text-[10px] tabular-nums font-bold flex-shrink-0"
              style={{ color: boost > 0 ? '#22c55e' : '#f87171', fontFamily: 'var(--font-display)' }}>
              {boost > 0 ? '+' : ''}{boost.toFixed(1)}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center pt-1.5 mt-0.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[9px] font-black uppercase tracking-wider"
            style={{ color: '#9090AA', fontFamily: 'var(--font-sport)' }}>
            Índice Taka
          </span>
          <span className="text-[12px] tabular-nums font-black"
            style={{ color: scoreColor(total), fontFamily: 'var(--font-display)' }}>
            {total.toFixed(1)}
          </span>
        </div>
      </div>

      {showProfileLink && (
        <div className="mt-2.5 pt-2 flex justify-end" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <Link
            href={`/rankings/${entry.id}`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-150"
            style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}
          >
            Ver perfil completo →
          </Link>
        </div>
      )}
    </div>
  )
}
