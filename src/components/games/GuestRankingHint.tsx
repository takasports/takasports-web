'use client'

// Banner que se muestra a usuarios sin sesión sobre /juegos.
// Mensaje: "Inicia sesión para entrar al ranking global."
// Click → abre el AuthModal existente.
//
// Detecta sesión via supabase browser client. Si no hay supabase o ya
// hay sesión, no renderiza nada.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import AuthModal from '@/components/AuthModal'

export default function GuestRankingHint() {
  const [needsLogin, setNeedsLogin] = useState(false)
  const [showModal,  setShowModal]  = useState(false)
  const [dismissed,  setDismissed]  = useState(false)

  useEffect(() => {
    const sb = createClient()
    if (!sb) return
    let cancelled = false
    sb.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setNeedsLogin(!data.user)
    })
    // Si el usuario inicia sesión durante la sesión, ocultar el banner.
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setNeedsLogin(!session?.user)
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    try {
      if (localStorage.getItem('ts_games_hint_dismissed') === '1') setDismissed(true)
    } catch { /* ignore */ }
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    try { localStorage.setItem('ts_games_hint_dismissed', '1') } catch { /* ignore */ }
  }

  if (!needsLogin || dismissed) return null

  return (
    <>
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-8"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(167,139,250,0.06))',
          border: '1px solid rgba(167,139,250,0.25)',
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(167,139,250,0.18)', color: '#A78BFA' }}
          aria-hidden
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2l1.5 3.2 3.5.5-2.5 2.4.6 3.4L7 9.8 3.9 11.5l.6-3.4L2 5.7l3.5-.5L7 2z" stroke="#A78BFA" strokeWidth="1.2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
            Compite en el ranking
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Inicia sesión para que tus partidas cuenten en los rankings semanales.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg,#7C3AED,#5B21B6)',
            color: '#fff',
            fontFamily: 'var(--font-sport)',
            letterSpacing: '0.06em',
          }}
        >
          Entrar
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Cerrar"
          className="text-[10px] flex-shrink-0 transition-opacity hover:opacity-100"
          style={{ color: '#5A5A7A', opacity: 0.6 }}
        >
          ✕
        </button>
      </div>

      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </>
  )
}
