'use client'

import React from 'react'

export default function ShareButton({ title }: { title: string }) {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleClick = async () => {
    if (typeof navigator !== 'undefined' && navigator.share && /Mobi|Android|iPhone/.test(navigator.userAgent)) {
      try { await navigator.share({ title, url: window.location.href }) } catch { /* cancelled */ }
      return
    }
    setOpen((v) => !v)
  }

  const url = typeof window !== 'undefined' ? window.location.href : ''
  const encUrl = encodeURIComponent(url)
  const encTitle = encodeURIComponent(title)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => { setCopied(false); setOpen(false) }, 1400)
    } catch { /* ignore */ }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={handleClick}
        aria-label="Compartir artículo"
        aria-expanded={open}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
        style={{ background: 'rgba(255,255,255,0.06)', color: '#8E8E9E', border: '1px solid var(--border)' }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="10.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="10.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="2.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M4 5.8L9 3.2M4 7.2L9 9.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        Compartir
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 rounded-xl overflow-hidden z-20"
          style={{
            background: 'var(--bg-card, #15151f)',
            border: '1px solid var(--border)',
            minWidth: 200,
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
          }}
        >
          <a
            href={`https://twitter.com/intent/tweet?text=${encTitle}&url=${encUrl}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors"
            style={{ color: '#D1D1E0' }}
            onClick={() => setOpen(false)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2H21l-6.52 7.45L22 22h-6.793l-5.32-6.94L3.7 22H1l7.04-8.04L1 2h6.93l4.81 6.36L18.244 2zm-1.19 18.36h1.5L7.05 3.55H5.45L17.054 20.36z"/></svg>
            Compartir en X
          </a>
          <a
            href={`https://wa.me/?text=${encTitle}%20${encUrl}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors"
            style={{ color: '#D1D1E0' }}
            onClick={() => setOpen(false)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encUrl}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors"
            style={{ color: '#D1D1E0' }}
            onClick={() => setOpen(false)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 011.141.195v3.325a8.623 8.623 0 00-.653-.036 26.805 26.805 0 00-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 00-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647z"/></svg>
            Facebook
          </a>
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors text-left"
            style={{ color: '#D1D1E0', borderTop: '1px solid var(--border)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            {copied ? 'URL copiada ✓' : 'Copiar enlace'}
          </button>
        </div>
      )}
    </div>
  )
}
