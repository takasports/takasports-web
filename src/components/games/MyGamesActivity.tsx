'use client'

// Sección "Tu actividad en TakaSports" para incrustar en /perfil.
//
// Renderiza:
//   · racha global (🔥 N días · mejor M)
//   · resumen por juego (mejor score · partidas · última partida)
//
// Failsafe: si no hay sesión, fetch falla o no hay datos → no renderiza
// nada. Las secciones de localStorage de /perfil siguen intactas.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { MeAllResponse, GameSummary } from '@/app/api/games/me/all/route'

interface GameMeta {
  label:  string
  accent: string
  href:   string
}

const META: Record<GameSummary['game_id'], GameMeta> = {
  quiniela:    { label: 'Quiniela',       accent: '#A78BFA', href: '/quiniela' },
  crackquiz:   { label: 'CrackQuiz',      accent: '#FCD34D', href: '/crackquiz' },
  mionce:      { label: 'Mi Once',        accent: '#93C5FD', href: '/mionce' },
  sopacracks:  { label: 'Sopa de Cracks', accent: '#6EE7B7', href: '/sopa-cracks' },
  takagrid:    { label: 'TakaGrid',       accent: '#FDBA74', href: '/takagrid' },
  strikerrush: { label: 'Striker Rush',   accent: '#FCA5A5', href: '/juegos' },
}

function fmtAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return 'hace un momento'
  if (d < 3600) return `hace ${Math.floor(d/60)} min`
  if (d < 86400) return `hace ${Math.floor(d/3600)} h`
  if (d < 30*86400) return `hace ${Math.floor(d/86400)} d`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function MyGamesActivity() {
  const [data,    setData]    = useState<MeAllResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/games/me/all', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((d: MeAllResponse | null) => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Si no hay sesión / no hay datos / fetch falló → no renderizar (failsafe).
  if (loading || !data) return null
  const hasAny = (data.streak && data.streak.total > 0) || data.games.length > 0
  if (!hasAny) return null

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="section-accent" />
        <h2 className="section-label">Tu actividad en TakaSports</h2>
      </div>

      {/* Racha global */}
      {data.streak && data.streak.current > 0 && (
        <div
          className="rounded-2xl p-5 mb-4 flex items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(251,146,60,0.10), rgba(220,38,38,0.05))',
            border: '1px solid rgba(251,146,60,0.25)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(251,146,60,0.18)', fontSize: 22 }}
            aria-hidden
          >
            🔥
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#FB923C', fontFamily: 'var(--font-sport)' }}>
              Racha activa
            </p>
            <p className="font-black" style={{ fontFamily: 'var(--font-display)', color: '#F8F8FF', fontSize: 24, lineHeight: 1 }}>
              {data.streak.current} {data.streak.current === 1 ? 'día' : 'días'}
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Mejor racha: <strong style={{ color: '#FB923C' }}>{data.streak.best} días</strong> · {data.streak.total} {data.streak.total === 1 ? 'partida total' : 'partidas totales'}
            </p>
          </div>
        </div>
      )}

      {/* Resumen por juego */}
      {data.games.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.games.map(g => {
            const meta = META[g.game_id]
            return (
              <Link
                key={g.game_id}
                href={meta.href}
                className="rounded-2xl p-4 flex flex-col gap-2 transition-transform hover:translate-y-[-1px]"
                style={{ background: 'var(--bg-card)', border: `1px solid ${meta.accent}28` }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: meta.accent, fontFamily: 'var(--font-sport)' }}
                  >
                    {meta.label}
                  </span>
                  <span
                    className="text-[9px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}
                  >
                    {g.plays} {g.plays === 1 ? 'partida' : 'partidas'}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span
                    className="font-black leading-none"
                    style={{ color: meta.accent, fontFamily: 'var(--font-display)', fontSize: 28 }}
                  >
                    {g.best_score}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>mejor score</span>
                </div>

                <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Última: <strong style={{ color: '#9090B0' }}>{g.last_score} pts</strong>
                  </span>
                  <span className="text-[10px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
                    {fmtAgo(g.last_at)}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
