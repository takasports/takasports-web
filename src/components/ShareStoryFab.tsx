'use client'

// Botón flotante de compartir, apilado JUSTO ENCIMA del de "volver arriba".
//
// Las dos posiciones están acopladas a mano: ScrollToTop se ancla en
// `bottom: calc(72px + safe-area)` y mide 40 px (w-10 h-10), así que este se
// pone 52 px más arriba (40 del botón + 12 de aire). Si se toca la posición de
// ScrollToTop, hay que tocar esta. Misma anchura, mismo radio y mismo umbral de
// aparición (500 px de scroll) para que se lean como una pareja y no como dos
// cosas sueltas que coinciden.
//
// Se esconde cuando el bloque grande del final entra en pantalla: dos veces la
// misma petición a la vez es ruido.

import { useEffect, useRef, useState } from 'react'
import { useShareStory } from '@/lib/useShareStory'

export const SHARE_CTA_ANCHOR_ID = 'share-story-cta'

export default function ShareStoryFab({
  slug,
  title,
  accent = '#7C3AED',
}: {
  slug?: string
  title: string
  accent?: string
}) {
  const [scrolled, setScrolled] = useState(false)
  const [ctaOnScreen, setCtaOnScreen] = useState(false)
  const { state, share, prefetch } = useShareStory({ slug, title })
  const liveRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const target = document.getElementById(SHARE_CTA_ANCHOR_ID)
    if (!target) return
    const io = new IntersectionObserver(
      ([entry]) => setCtaOnScreen(entry.isIntersecting),
      { rootMargin: '0px 0px -80px 0px' },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [])

  // Precarga en cuanto el botón aparece: a los 500 px de scroll el lector ya
  // está enganchado, y así al pulsar la placa está en memoria y `share()` se
  // llama dentro del gesto (ver useShareStory).
  useEffect(() => {
    if (scrolled) prefetch()
  }, [scrolled, prefetch])

  if (!slug) return null
  const visible = scrolled && !ctaOnScreen

  const label =
    state === 'busy'   ? 'Creando la imagen…' :
    state === 'ready'  ? 'Listo, toca para compartir' :
    state === 'shared' || state === 'downloaded' ? 'Enlace copiado, pégalo en el sticker' :
    state === 'failed' ? 'No se pudo crear la imagen' :
    'Compartir en historia'

  return (
    <>
      <button
        onClick={share}
        disabled={state === 'busy'}
        aria-label={label}
        className="fixed right-4 sm:right-6 z-[45] w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:cursor-progress"
        style={{
          // 72 (ancla de ScrollToTop) + 40 (su alto) + 12 (aire) = 124
          bottom: 'calc(124px + env(safe-area-inset-bottom, 0px))',
          background: state === 'ready' ? accent : `${accent}d9`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${accent}66`,
          boxShadow: `0 4px 24px ${accent}4d`,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.85)',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        {state === 'ready' ? (
          // Segundo toque pendiente: mismo avión, trazo más grueso y fondo sólido
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M21.4 2.6L10.9 13.1M21.4 2.6l-6.7 18.6-3.8-8.1-8.1-3.8L21.4 2.6z"
                  stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : state === 'busy' ? (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="animate-spin">
            <circle cx="8" cy="8" r="6" stroke="#fff" strokeWidth="1.7"
                    strokeLinecap="round" strokeDasharray="24 12" />
          </svg>
        ) : state === 'shared' || state === 'downloaded' ? (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.4l3.2 3.2L13 4.6" stroke="#fff" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          // Avión de papel: el mismo gesto de "compartir" de los reels
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M21.4 2.6L10.9 13.1M21.4 2.6l-6.7 18.6-3.8-8.1-8.1-3.8L21.4 2.6z"
                  stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* El estado del botón flotante no cabe en 40 px: se anuncia por voz. */}
      <span ref={liveRef} role="status" aria-live="polite" className="sr-only">
        {state === 'idle' ? '' : label}
      </span>
    </>
  )
}
