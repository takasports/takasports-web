'use client'

import { useState } from 'react'

export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    if (typeof window === 'undefined') return
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} · Índice Taka`, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }
    } catch { /* user cancel — silent */ }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:brightness-125"
      style={{
        background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(124,58,237,0.12)',
        color: copied ? '#22c55e' : '#C4B5FD',
        border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(124,58,237,0.3)'}`,
        fontFamily: 'var(--font-sport)',
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        {copied ? (
          <>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Link copiado
          </>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M6 10l4-4M5.5 11l-1 1a2.5 2.5 0 1 1-3.5-3.5l1-1M10.5 5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Compartir
          </>
        )}
      </span>
    </button>
  )
}
