'use client'

import { useState } from 'react'

export function ShareButton({ title, text, imageUrl }: { title: string; text?: string; imageUrl?: string }) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  // Intenta compartir la tarjeta (imagen OG) como archivo. Devuelve true si se
  // compartió; false si el navegador no soporta compartir ficheros o falla
  // (→ se degrada a compartir el enlace). La imagen OG se genera bajo demanda,
  // por eso puede tardar ~1 s; mientras, el botón muestra "Preparando…".
  async function shareImage(url: string): Promise<boolean> {
    if (!imageUrl || typeof navigator.canShare !== 'function') return false
    try {
      const res = await fetch(imageUrl)
      if (!res.ok) return false
      const blob = await res.blob()
      const file = new File([blob], 'takasports.png', { type: blob.type || 'image/png' })
      if (!navigator.canShare({ files: [file] })) return false
      await navigator.share({ files: [file], title, text: text ?? title, url })
      return true
    } catch {
      // cancelado o no soportado → degradar
      return false
    }
  }

  async function handleShare() {
    const url = window.location.href
    if (imageUrl) {
      setBusy(true)
      const shared = await shareImage(url)
      setBusy(false)
      if (shared) return
    }
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
      disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all hover:opacity-80 active:scale-95 disabled:opacity-60"
      style={{
        background: 'rgba(255,255,255,0.06)',
        color: copied ? '#4ade80' : 'var(--text-muted)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontFamily: 'var(--font-sport)',
      }}
    >
      {busy ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="18 10" />
          </svg>
          Preparando…
        </>
      ) : copied ? (
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
