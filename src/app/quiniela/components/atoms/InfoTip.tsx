'use client'

import { useState, useEffect, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────
// Info tooltip — accesible, tap/hover, cierra con Esc o click fuera
// ─────────────────────────────────────────────────────────────────
export function InfoTip({ label, text, size = 12 }: { label: string; text: string; size?: number }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <span ref={ref} className="relative inline-flex items-center" style={{ lineHeight: 0 }}>
      <button
        type="button"
        aria-label={`Información: ${label}`}
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        className="rounded-full inline-flex items-center justify-center transition-opacity"
        style={{ width: size + 4, height: size + 4, background: 'rgba(255,255,255,0.06)', color: '#7C7CA0', border: 'none', cursor: 'pointer', opacity: open ? 1 : 0.7 }}
      >
        <svg width={size - 2} height={size - 2} viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.1" /><path d="M6 5.4v2.4M6 4v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
      </button>
      {open && (
        <span role="tooltip" className="absolute z-50 left-1/2 -translate-x-1/2 mt-2 px-3 py-2 rounded-lg text-[10px] leading-snug shadow-xl" style={{ top: '100%', minWidth: 180, maxWidth: 240, background: '#1a0a2e', border: '1px solid rgba(124,58,237,0.35)', color: '#E0D5F8', fontFamily: 'var(--font-sport)', fontWeight: 600 }}>
          <span className="block font-black mb-1" style={{ color: '#C4B5FD', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
          {text}
        </span>
      )}
    </span>
  )
}
