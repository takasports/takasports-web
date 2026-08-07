'use client'

// Una sola barra con TODO el estado del jugador en la zona de juegos.
//
// Antes esto eran CINCO bloques apilados en la cabecera del hub, y tres de
// ellos decían el mismo número:
//   · MetaProgressionStrip  → "Racha Taka: 3 días" + nivel Liga Taka
//   · StreakChip            → "3 días · mejor 7"      (la misma racha)
//   · StreakAtRiskBanner    → "¡Racha en riesgo!"     (la misma racha)
//   · GuestRankingHint      → aviso de entrar
//   · PushOptIn             → un chip suelto alineado a la derecha, sin contexto
// Más la cabecera de "Tu día Taka" con el "0/4 hechos".
//
// Ahora: una línea. Racha, nivel, progreso del día y el botón para seguir. El
// aviso de racha en riesgo no es otro bloque, es que el propio contador se
// pone en naranja y lo dice. Para invitados, una sola frase.

import Link from 'next/link'
import { FireIcon, BoltIcon } from '@/components/icons/GameIcons'
import type { GamesOverview } from '@/hooks/useGamesOverview'

interface Props {
  overview: GamesOverview
  /** Ruta del primer juego pendiente, para el CTA. */
  nextHref?: string
  nextLabel?: string
}

export default function GamesStatusBar({ overview, nextHref, nextLabel }: Props) {
  const { status, streak, level, done, total } = overview

  // Invitado: una sola frase, sin ocupar media pantalla.
  if (status === 'guest') {
    return (
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
      >
        <span className="inline-flex flex-shrink-0" style={{ color: '#FDBA74' }} aria-hidden>
          <FireIcon size={15} />
        </span>
        <p className="text-[13px] flex-1 min-w-[220px]" style={{ color: 'var(--text-secondary)' }}>
          Puedes jugar sin cuenta. <strong style={{ color: '#F0F0F5' }}>Entra</strong> y se te guardan la
          racha y los puntos de la Liga Taka.
        </p>
        <Link
          href="/auth"
          className="text-[10px] font-black uppercase tracking-widest px-3.5 py-2 rounded-xl transition-opacity hover:opacity-90 flex-shrink-0"
          style={{ background: '#7C3AED', color: '#fff', fontFamily: 'var(--font-sport)' }}
        >
          Entrar
        </Link>
      </div>
    )
  }

  // Mientras carga NO se pinta una caja vacía: se pinta la misma fila con los
  // valores en gris. Un recuadro hueco esperando datos es exactamente lo que
  // hacía que la cabecera pareciera rota.
  const loading = status === 'loading'
  const current = streak?.current ?? 0
  // Racha viva pero sin jugar nada hoy: el propio contador avisa, en vez de
  // un banner rojo aparte.
  const atRisk = current >= 2 && done === 0
  const allDone = total > 0 && done === total

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-x-5 gap-y-3 flex-wrap"
      style={{
        background: atRisk
          ? 'linear-gradient(135deg, rgba(251,146,60,0.10), rgba(255,255,255,0.02))'
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${atRisk ? 'rgba(251,146,60,0.35)' : 'var(--border)'}`,
      }}
    >
      {/* Racha */}
      <div className="flex items-center gap-2">
        <span
          className="inline-flex flex-shrink-0"
          style={{ color: !loading && current > 0 ? '#FB923C' : '#5A5A7A' }}
          aria-hidden
        >
          <FireIcon size={16} />
        </span>
        <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          {loading ? (
            <span style={{ color: '#5A5A7A' }}>Cargando tu racha…</span>
          ) : (
            <>
              <strong style={{ color: current > 0 ? '#FB923C' : '#9090B0' }}>
                {current} {current === 1 ? 'día' : 'días'}
              </strong>
              {' '}de racha
              {atRisk && <span style={{ color: '#FB923C' }}> · en riesgo hoy</span>}
            </>
          )}
        </span>
      </div>

      <span className="hidden sm:block w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* Nivel Liga Taka */}
      {level && (
        <>
          <div className="flex items-center gap-2 min-w-[150px] flex-1 max-w-[280px]">
            <span className="inline-flex flex-shrink-0" style={{ color: '#93C5FD' }} aria-hidden>
              <BoltIcon size={14} />
            </span>
            <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
              Nivel <strong style={{ color: '#93C5FD' }}>{level.level}</strong>
            </span>
            <div
              className="h-1.5 rounded-full overflow-hidden flex-1"
              style={{ background: 'rgba(255,255,255,0.07)' }}
              role="progressbar"
              aria-valuenow={Math.round(level.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progreso al nivel ${level.level + 1}`}
            >
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${Math.round(level.progress * 100)}%`, background: '#93C5FD' }}
              />
            </div>
          </div>
          <span className="hidden sm:block w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </>
      )}

      {/* Progreso del día + siguiente */}
      <div className="flex items-center gap-3 ml-auto">
        <span
          className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap"
          style={{ color: !loading && allDone ? '#86EFAC' : 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
        >
          {loading ? `—/${total}` : `${done}/${total}`} jugados
        </span>
        {!loading && !allDone && nextHref && (
          <Link
            href={nextHref}
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-opacity hover:opacity-80 whitespace-nowrap"
            style={{
              background: 'rgba(124,58,237,0.16)',
              color: '#C4B5FD',
              border: '1px solid rgba(124,58,237,0.35)',
              fontFamily: 'var(--font-sport)',
            }}
          >
            Seguir con {nextLabel} →
          </Link>
        )}
      </div>
    </div>
  )
}
