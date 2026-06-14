'use client'

// Sección "Tus datos" del perfil: descarga toda la información del usuario en un
// JSON (RGPD art. 20, portabilidad). Solo se monta cuando hay sesión. Llama a
// GET /api/account/export (cookie-auth + service_role) y fuerza la descarga.

import { useState } from 'react'

export default function ExportDataSection() {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  async function handleDownload() {
    if (state === 'loading') return
    setState('loading')
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) throw new Error('export_failed')
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition')
      const match = cd ? cd.match(/filename="([^"]+)"/) : null
      const filename = match ? match[1] : 'takasports-mis-datos.json'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setState('idle')
    } catch {
      setState('error')
    }
  }

  return (
    <section className="mt-2">
      <div
        className="rounded-2xl p-4 sm:p-5"
        style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.22)' }}
      >
        <p
          className="text-[10px] font-black uppercase tracking-widest mb-1.5"
          style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)', letterSpacing: '0.08em' }}
        >
          Tus datos
        </p>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Descarga una copia de todo lo que TakaSports guarda de ti (perfil, picks, predicciones,
          favoritos, recordatorios, historial, puntos e insignias) en un archivo <strong style={{ color: '#C4B5FD' }}>.json</strong>.
        </p>
        <button
          onClick={handleDownload}
          disabled={state === 'loading'}
          className="inline-flex items-center gap-2 text-[12px] font-bold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
          style={{
            color: '#C4B5FD',
            fontFamily: 'var(--font-sport)',
            background: 'rgba(124,58,237,0.12)',
            border: '1px solid rgba(124,58,237,0.34)',
            cursor: state === 'loading' ? 'wait' : 'pointer',
            padding: '9px 16px',
            borderRadius: 12,
          }}
        >
          {state === 'loading' ? (
            <>
              <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-purple-300 border-t-white animate-spin" />
              Preparando…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1.5v7m0 0L4.5 6M7 8.5L9.5 6M2 10.5v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Descargar mis datos (.json)
            </>
          )}
        </button>
        {state === 'error' && (
          <p className="text-[11px] mt-2.5" style={{ color: '#fca5a5', fontFamily: 'var(--font-sport)' }} role="alert">
            No se pudo preparar la descarga. Inténtalo de nuevo en unos minutos.
          </p>
        )}
      </div>
    </section>
  )
}
