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
      {copied ? '✓ Link copiado' : '🔗 Compartir'}
    </button>
  )
}
