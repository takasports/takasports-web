'use client'

import { useState, useEffect } from 'react'

export function LeagueShareModal({ leagueId, leagueName, onClose }: { leagueId: string; leagueName: string; onClose: () => void }) {
  const [qrSvg, setQrSvg]   = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/quiniela?liga=${leagueId}`
    : `/quiniela?liga=${leagueId}`

  useEffect(() => {
    let cancelled = false
    // Carga `qrcode` dinámicamente: evita inflar el bundle del page principal
    import('qrcode').then(QR => {
      QR.toString(url, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        color: { dark: '#F8F8FF', light: '#0B0014' },
      }).then(svg => { if (!cancelled) setQrSvg(svg) })
        .catch(() => {})
    }).catch(() => {})
    return () => { cancelled = true }
  }, [url])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* ignore */ }
  }

  const share = async () => {
    const text = `Únete a mi liga «${leagueName}» en TakaSports — código ${leagueId}`
    try {
      if (navigator.share) await navigator.share({ title: leagueName, text, url })
      else copy()
    } catch { /* user cancelled */ }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Compartir liga ${leagueName}`} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" style={{ background: 'rgba(3,0,9,0.85)', backdropFilter: 'blur(12px)', animation: 'fadeIn 0.2s ease both' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 relative" style={{ background: 'linear-gradient(160deg,#13002A 0%,#08000F 100%)', border: '1px solid rgba(124,58,237,0.3)', boxShadow: '0 -24px 60px rgba(0,0,0,0.6)', animation: 'sealPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <button aria-label="Cerrar" onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: '#9090B0', border: 'none', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>

        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#9080C0', fontFamily: 'var(--font-sport)' }}>Compartir liga</p>
        <h2 className="font-black mb-1" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem,4vw,1.75rem)', color: '#F8F8FF', letterSpacing: '-0.02em', lineHeight: 1.05 }}>{leagueName}</h2>
        <p className="text-xs mb-5" style={{ color: '#7060A0', fontFamily: 'var(--font-sport)' }}>Código <span className="tabular-nums font-black" style={{ color: '#C4B5FD' }}>{leagueId}</span></p>

        <div className="rounded-2xl p-4 mb-4 flex items-center justify-center" style={{ background: '#0B0014', border: '1px solid rgba(124,58,237,0.18)', minHeight: 200 }}>
          {qrSvg ? (
            <div aria-label="Código QR" style={{ width: 180, height: 180 }} dangerouslySetInnerHTML={{ __html: qrSvg.replace('<svg', '<svg width="180" height="180"') }} />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
              <span className="text-[10px]" style={{ color: '#4A3A60', fontFamily: 'var(--font-sport)' }}>Generando QR…</span>
            </div>
          )}
        </div>

        <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 mb-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="text-[10px] truncate flex-1" style={{ color: '#9090B0', fontFamily: 'var(--font-sport)' }}>{url}</span>
          <button onClick={copy} className="text-[10px] font-black px-2.5 py-1 rounded-lg flex-shrink-0" style={{ background: copied ? 'rgba(34,197,94,0.18)' : 'rgba(124,58,237,0.18)', color: copied ? '#4ade80' : '#C4B5FD', border: copied ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(124,58,237,0.35)', fontFamily: 'var(--font-sport)', cursor: 'pointer', minHeight: 36 }}>
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <button onClick={share} className="w-full rounded-xl text-xs font-black uppercase tracking-widest transition-opacity hover:opacity-90" style={{ minHeight: 48, background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', border: '1px solid rgba(124,58,237,0.5)', fontFamily: 'var(--font-sport)', letterSpacing: '0.1em', boxShadow: '0 6px 22px rgba(124,58,237,0.35)', cursor: 'pointer' }}>
          📤 Compartir enlace
        </button>
      </div>
    </div>
  )
}
