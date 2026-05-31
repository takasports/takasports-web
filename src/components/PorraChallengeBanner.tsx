'use client'

// Banner que aparece en /predicciones cuando el URL trae ?reto=TOKEN.
//
// Comportamiento:
//  · Parsea el token (leagueId + handle opcional).
//  · Muestra "X te ha retado · Jornada activa" con CTA "ACEPTAR RETO".
//  · "Aceptar" hace router.replace con ?liga=<leagueId> → QuinielaClient
//    coge el flow existente de unirse a liga.
//  · "Ahora no" lo cierra y deja el reto guardado en sessionStorage por
//    si el user vuelve a entrar — no quema la oportunidad.

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseChallengeToken } from '@/lib/porra-challenge'

const DISMISSED_KEY = 'porra:challengeDismissed'

export default function PorraChallengeBanner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [show, setShow] = useState(false)
  const [parsed, setParsed] = useState<{ leagueId: string; handle: string | null } | null>(null)

  useEffect(() => {
    const tok = searchParams?.get('reto')
    if (!tok) { setShow(false); return }
    const p = parseChallengeToken(tok)
    if (!p) { setShow(false); return }
    // Si ya fue descartado en esta sesión, no insistas.
    try {
      const dismissed = sessionStorage.getItem(DISMISSED_KEY)
      if (dismissed === tok) { setShow(false); return }
    } catch { /* */ }
    setParsed(p)
    setShow(true)
  }, [searchParams])

  function handleAccept() {
    if (!parsed) return
    // Construye nueva URL preservando otros params, intercambiando ?reto= por ?liga=.
    const next = new URLSearchParams(searchParams?.toString() ?? '')
    next.delete('reto')
    next.set('liga', parsed.leagueId)
    router.replace(`/predicciones?${next.toString()}`)
    setShow(false)
  }

  function handleDismiss() {
    const tok = searchParams?.get('reto')
    if (tok) {
      try { sessionStorage.setItem(DISMISSED_KEY, tok) } catch { /* */ }
    }
    setShow(false)
  }

  if (!show || !parsed) return null

  const who = parsed.handle ? parsed.handle.charAt(0).toUpperCase() + parsed.handle.slice(1) : 'Te'

  return (
    <div
      role="status"
      className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 mt-3"
      style={{
        animation: 'porraChallengeIn 280ms cubic-bezier(0.34,1.4,0.64,1) both',
      }}
    >
      <div
        className="relative overflow-hidden rounded-2xl p-4 sm:p-5 flex items-center gap-4"
        style={{
          background:
            'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(249,115,22,0.14) 50%, rgba(124,58,237,0.14) 100%)',
          border: '1px solid rgba(251,191,36,0.36)',
          boxShadow: '0 0 28px rgba(251,191,36,0.14)',
        }}
      >
        <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }} aria-hidden>🥊</span>
        <div className="flex-1 min-w-0">
          <p style={{
            fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 13,
            color: '#FDE68A', letterSpacing: '0.06em', margin: 0,
          }}>
            {parsed.handle ? `${who} te ha retado` : 'Te han retado'}
          </p>
          <p style={{
            fontSize: 12, color: 'rgba(255,255,255,0.78)',
            margin: '4px 0 0', lineHeight: 1.4,
          }}>
            Únete a su liga, sella tus picks y demuestra quién manda esta jornada.
          </p>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleAccept}
            style={{
              padding: '8px 16px', borderRadius: 10,
              background: 'linear-gradient(135deg, #F97316 0%, #FBBF24 100%)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#0F0F18',
              fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 11,
              letterSpacing: '0.08em', cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 6px 14px rgba(251,191,36,0.3)',
            }}
          >
            ACEPTAR RETO
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              padding: '4px 8px', borderRadius: 6,
              background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontFamily: 'var(--font-sport)', fontWeight: 700, fontSize: 9,
              letterSpacing: '0.06em', cursor: 'pointer',
            }}
          >
            AHORA NO
          </button>
        </div>
      </div>
      <style>{`
        @keyframes porraChallengeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
