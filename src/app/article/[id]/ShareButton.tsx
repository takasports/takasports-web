'use client'

import React from 'react'

export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleShare = async () => {
    const url = window.location.href
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title, url }) } catch { /* user cancelled */ }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
      style={{ background: 'rgba(255,255,255,0.06)', color: '#8E8E9E', border: '1px solid var(--border)' }}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="10.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="10.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="2.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4 5.8L9 3.2M4 7.2L9 9.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      {copied ? 'URL copiada ✓' : 'Compartir'}
    </button>
  )
}
