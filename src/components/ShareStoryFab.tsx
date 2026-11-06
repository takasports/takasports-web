'use client'

// Botón flotante de compartir.
//
// En MÓVIL es el único flotante (maqueta 1 de noviembre, V-06): 48 px, morado
// de marca, a 16 px de la cápsula de la barra inferior (`.fab-compartir` en
// globals.css). En escritorio sigue apilado JUSTO ENCIMA del de "volver
// arriba": ScrollToTop se ancla en `bottom: calc(72px + safe-area)` y mide 40
// px, así que este se pone 52 px más arriba (40 del botón + 12 de aire). Si se
// toca la posición de ScrollToTop, hay que tocar `.fab-compartir`.
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
        className="fab-compartir fixed right-5 sm:right-6 z-[45] w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:cursor-progress"
        style={{
          // Morado de marca, no el acento del deporte: es una acción, y en la
          // maqueta el color de deporte vive solo en el rótulo. `accent` se
          // conserva para el segundo toque (placa lista).
          background: state === 'ready' ? accent : 'var(--purple)',
          border: 'none',
          boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.85)',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        {state === 'ready' ? (
          // Segundo toque pendiente: mismo avión, trazo más grueso y fondo sólido
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M21.4 2.6L10.9 13.1M21.4 2.6l-6.7 18.6-3.8-8.1-8.1-3.8L21.4 2.6z"
                  stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : state === 'busy' ? (
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className="animate-spin">
            <circle cx="8" cy="8" r="6" stroke="#fff" strokeWidth="1.7"
                    strokeLinecap="round" strokeDasharray="24 12" />
          </svg>
        ) : state === 'shared' || state === 'downloaded' ? (
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.4l3.2 3.2L13 4.6" stroke="#fff" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          // Icono de compartir (tres nodos), el mismo de la cabecera de la nota.
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="18" cy="5" r="2.5" stroke="#fff" strokeWidth="1.8" />
            <circle cx="6" cy="12" r="2.5" stroke="#fff" strokeWidth="1.8" />
            <circle cx="18" cy="19" r="2.5" stroke="#fff" strokeWidth="1.8" />
            <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
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
