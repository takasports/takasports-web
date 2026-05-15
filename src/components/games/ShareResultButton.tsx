'use client'

// Botón reusable para compartir el resultado de cualquier juego.
// Uso: <ShareResultButton play={gamePlay} />
// Estilo: pill morada con icono "share", coherente con la UI de /juegos.

import { useState } from 'react'
import { shareResult } from '@/lib/share'
import { trackGameEvent } from '@/lib/games-telemetry'
import type { GamePlay } from '@/lib/games-store'

interface Props {
  play:      GamePlay
  accent?:   string  // CSS color del juego
  label?:    string  // texto del botón
  fullWidth?: boolean
}

export default function ShareResultButton({ play, accent = '#A78BFA', label = 'Compartir resultado', fullWidth = false }: Props) {
  const [state, setState] = useState<'idle' | 'busy' | 'copied' | 'shared' | 'failed'>('idle')

  const onClick = async () => {
    if (state === 'busy') return
    setState('busy')
    const res = await shareResult(play)
    if (res !== 'failed') {
      trackGameEvent({ gameId: play.game_id, event: 'shared', period: play.period, meta: { via: res } })
    }
    setState(res === 'failed' ? 'failed' : res)
    setTimeout(() => setState('idle'), 2500)
  }

  const text =
    state === 'copied' ? '✓ Copiado al portapapeles' :
    state === 'shared' ? '✓ Compartido' :
    state === 'failed' ? 'No se pudo compartir' :
    label

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'busy'}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${fullWidth ? 'w-full' : ''}`}
      style={{
        background:   `${accent}14`,
        color:        accent,
        border:       `1px solid ${accent}30`,
        fontFamily:   'var(--font-sport)',
        letterSpacing:'0.06em',
        cursor:       state === 'busy' ? 'progress' : 'pointer',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M9 4l-4 3 4 3M5 7h6" stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="11" cy="3" r="1.5" stroke={accent} strokeWidth="1.4" />
        <circle cx="11" cy="11" r="1.5" stroke={accent} strokeWidth="1.4" />
        <circle cx="3" cy="7" r="1.5" stroke={accent} strokeWidth="1.4" />
      </svg>
      {text}
    </button>
  )
}
