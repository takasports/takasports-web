'use client'

// Modal explicativo del modo Contrarreloj de Sopa de Cracks. Se abre al
// intentar ACTIVAR el modo (no al desactivarlo) y hace de puerta de
// confirmación: explica las reglas del reto contrarreloj, y solo al
// pulsar "Activar" enciende el modo. Diálogo accesible (role=dialog,
// aria-modal, Escape, focus-trap y devolución de foco al disparador).

import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  accent: string
  onConfirm: () => void
  onClose: () => void
}

export default function TimeAttackInfoModal({ open, accent, onConfirm, onClose }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prevFocused = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'Tab' && dialogRef.current) {
        const f = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])'),
        ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)
        if (f.length === 0) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prevFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ta-info-title"
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-card)', border: `1px solid ${accent}40`, boxShadow: 'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center" style={{ padding: 'var(--space-lg) var(--space-lg) var(--space-md)' }}>
          <span aria-hidden="true" style={{ fontSize: 46, lineHeight: 1, marginBottom: 'var(--space-sm)' }}>⚡</span>
          <h2
            id="ta-info-title"
            className="font-black"
            style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: '#F8F8FF', letterSpacing: '-0.02em', marginBottom: 8 }}
          >
            Modo contrarreloj
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
            Tienes <strong style={{ color: '#F0F0F5' }}>3:00</strong> para encontrar el máximo de palabras. No hace falta hallarlas todas: cuentan las que consigas antes de que acabe el tiempo.
          </p>
          <ul className="mt-3 w-full flex flex-col gap-2 text-left">
            {[
              ['🏁', 'Reto a contrarreloj: 3:00 para tu máximo de palabras.'],
              ['⭐', 'Tus aciertos suman a tu Liga Taka, igual que el modo normal.'],
            ].map(([emoji, text]) => (
              <li key={text} className="flex items-start gap-2.5 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1.4 }}>{emoji}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.4 }}>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2" style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{
              padding: '13px',
              background: accent,
              color: '#0A0A12',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-sport)',
              fontWeight: 900,
              fontSize: 13,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Activar contrarreloj
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{
              padding: '11px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              fontFamily: 'var(--font-sport)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
