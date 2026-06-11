'use client'

import { useEffect, useRef, useState } from 'react'
import { LogoFull } from './Logo'

// Apertura "señal en directo": al entrar en la home, una vez por sesión, el
// logo aparece con un barrido de escáner de TV + un latido REC y se disuelve
// revelando la portada. Se monta SOLO tras hidratar (vía useEffect) → el hero
// ya pintó, así que NO bloquea el LCP. Con prefers-reduced-motion no aparece.
const SESSION_KEY = 'ts_signal_intro_shown'

// Guard a nivel de módulo: la decisión de reproducir se toma UNA vez por carga
// de página. Sobrevive al doble-invoke de useEffect que React hace en dev
// (StrictMode monta→limpia→remonta); sin esto, la 1ª pasada marcaba la sesión
// y la 2ª veía el flag puesto y se saltaba la intro (no se veía nunca en dev).
let launchedThisLoad = false

export default function SignalIntro() {
  // 'pending' → SSR y primer render cliente devuelven null (no overlay = sin LCP block).
  // 'playing' → overlay visible · 'leaving' → desvaneciéndose · 'done' → desmontado.
  const [phase, setPhase] = useState<'pending' | 'playing' | 'leaving' | 'done'>('pending')
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    if (launchedThisLoad) return
    launchedThisLoad = true

    let already = false
    try { already = sessionStorage.getItem(SESSION_KEY) === '1' } catch { /* ignore */ }
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (already || reduce) { setPhase('done'); return }

    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
    const set = (p: 'playing' | 'leaving' | 'done') => { if (aliveRef.current) setPhase(p) }
    set('playing')
    setTimeout(() => set('leaving'), 1150)
    setTimeout(() => set('done'), 1620)
    return () => { aliveRef.current = false }
  }, [])

  if (phase === 'pending' || phase === 'done') return null

  const leaving = phase === 'leaving'

  return (
    <div
      aria-hidden="true"
      onClick={() => setPhase('leaving')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base, #09090F)',
        opacity: leaving ? 0 : 1,
        transition: 'opacity 460ms ease',
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      {/* Viñeta de control de cámara */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo con barrido de escáner */}
      <div className="ts-signal-logoin" style={{ position: 'relative', overflow: 'hidden', padding: '12px 20px' }}>
        <LogoFull size={46} asLink={false} />
        <span
          className="ts-signal-sweep"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, transparent, var(--accent-action, #FF4D2E), transparent)',
            boxShadow: '0 0 14px 2px rgba(255,77,46,0.5)',
          }}
        />
      </div>

      {/* Indicador REC · EN DIRECTO */}
      <div className="ts-signal-logoin" style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          className="ts-rec-blink"
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: 'var(--color-live, #FF4D2E)',
            boxShadow: '0 0 10px rgba(255,77,46,0.85)',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-sport)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.3em',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          EN DIRECTO
        </span>
      </div>
    </div>
  )
}
