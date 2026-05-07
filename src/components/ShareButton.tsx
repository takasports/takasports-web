'use client'

import { useState } from 'react'

export function ShareButton({ title, text }: { title: string; text?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title, text: text ?? title, url })
      } catch {
        // user cancelled — no-op
      }
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all hover:opacity-80 active:scale-95"
      style={{
        background: 'rgba(255,255,255,0.06)',
        color: copied ? '#4ade80' : '#5A5A6A',
        border: '1px solid rgba(255,255,255,0.08)',
        fontFamily: 'var(--font-sport)',
      }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copiado
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="currentColor" opacity=".5"/>
            <path d="M6.5 3.5l-3 2M6.5 8.5l-3-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Compartir
        </>
      )}
    </button>
  )
}
