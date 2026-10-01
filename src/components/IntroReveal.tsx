'use client'

import { useEffect, useRef, useState } from 'react'

// Apertura de la home, una vez por sesión: el MISMO revelado que la app
// (takasports-app · AnimatedSplash) y que la careta de los reels ("OUTRO V1").
// El isotipo entra con motion blur vertical y el wordmark "TAKA SPORTS" se
// desliza desde la derecha. El blur está horneado en los fotogramas, así que
// va como secuencia de 12 WebP (public/intro/, 40 ms cada uno = los 25 fps del
// original) y no recreado con CSS: con transforms se perdería justo el carácter.
//
// Se monta SOLO tras hidratar (vía useEffect) → el hero ya pintó, así que NO
// bloquea el LCP y los fotogramas no se descargan en el HTML servido.
// Con prefers-reduced-motion no aparece.
const SESSION_KEY = 'ts_signal_intro_shown'

const FRAMES = Array.from({ length: 12 }, (_, i) => `/intro/reveal-${String(i).padStart(2, '0')}.webp`)
const FRAME_MS = 40
const REVEAL_MS = (FRAMES.length - 1) * FRAME_MS
// En la app el logo "respira" mientras cargan los datos; aquí la portada ya
// está debajo, así que solo se deja asentado un momento antes de salir.
const HOLD_MS = 500
const EXIT_MS = 380
// El revelado NO arranca hasta tener los fotogramas decodificados: en la app
// arrancaba a ciegas y la secuencia avanzaba sobre imágenes vacías (el logo
// completo aparecía justo a tiempo de irse). Si tardan más que esto, no hay
// intro: la portada ya está pintada debajo y no hay nada que esperar.
const LOAD_TIMEOUT_MS = 900

const EASE_IN_CUBIC = 'cubic-bezier(0.55, 0, 1, 0.45)'

// Guard a nivel de módulo: la decisión de reproducir se toma UNA vez por carga
// de página. Sobrevive al doble-invoke de useEffect que React hace en dev
// (StrictMode monta→limpia→remonta); sin esto, la 1ª pasada marcaba la sesión
// y la 2ª veía el flag puesto y se saltaba la intro (no se veía nunca en dev).
let launchedThisLoad = false

type Phase = 'pending' | 'loading' | 'playing' | 'leaving' | 'done'
// Las fases solo avanzan: un clic para saltar (→ leaving) no puede verse
// deshecho porque los fotogramas terminen de cargar después (→ playing).
const ORDER: Record<Phase, number> = { pending: 0, loading: 1, playing: 2, leaving: 3, done: 4 }

export default function IntroReveal() {
  // 'pending' → SSR y primer render cliente devuelven null (sin overlay = sin LCP block).
  // 'loading' → fondo + resplandor tapando, fotogramas decodificándose.
  const [phase, setPhase] = useState<Phase>('pending')
  const frameRefs = useRef<(HTMLImageElement | null)[]>([])
  const aliveRef = useRef(true)
  const phaseRef = useRef<Phase>('pending')
  const leaveRef = useRef<() => void>(() => {})

  useEffect(() => {
    aliveRef.current = true
    // La limpieza NO cancela los temporizadores: en dev, StrictMode desmonta y
    // remonta, y el remontaje (que ve launchedThisLoad) depende de que sigan
    // corriendo. Tras un desmontaje real, `set` ya no hace nada.
    const cleanup = () => { aliveRef.current = false }
    if (launchedThisLoad) return cleanup
    launchedThisLoad = true

    let already = false
    try { already = sessionStorage.getItem(SESSION_KEY) === '1' } catch { /* ignore */ }
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (already || reduce) { setPhase('done'); return cleanup }

    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
    const set = (p: Phase) => {
      if (!aliveRef.current || ORDER[p] <= ORDER[phaseRef.current]) return
      phaseRef.current = p
      setPhase(p)
    }
    const leave = () => {
      if (ORDER[phaseRef.current] >= ORDER.leaving) return
      set('leaving')
      setTimeout(() => set('done'), EXIT_MS)
    }
    leaveRef.current = leave
    set('loading')

    const showFrame = (n: number) => {
      frameRefs.current.forEach((img, i) => { if (img) img.style.opacity = i === n ? '1' : '0' })
    }

    // El stepping va por rAF midiendo el tiempo real (no un setTimeout por
    // fotograma): si el hilo se atasca, salta al fotograma que toca en vez de
    // ralentizar el revelado.
    const play = () => {
      if (!aliveRef.current || phaseRef.current !== 'loading') return
      set('playing')
      const t0 = performance.now()
      const tick = (now: number) => {
        const n = Math.min(FRAMES.length - 1, Math.floor((now - t0) / FRAME_MS))
        showFrame(n)
        if (n < FRAMES.length - 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      setTimeout(leave, REVEAL_MS + HOLD_MS)
    }

    let settled = false
    const decoded = FRAMES.map((src) => {
      const img = new Image()
      img.src = src
      return img.decode()
    })
    Promise.all(decoded).then(
      () => { if (!settled) { settled = true; play() } },
      () => { if (!settled) { settled = true; leave() } },
    )
    setTimeout(() => {
      if (settled) return
      settled = true
      leave()
    }, LOAD_TIMEOUT_MS)

    return cleanup
  }, [])

  if (phase === 'pending' || phase === 'done') return null

  const leaving = phase === 'leaving'
  const lit = phase === 'playing'

  return (
    <div
      aria-hidden="true"
      onClick={() => leaveRef.current()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base, #09090F)',
        opacity: leaving ? 0 : 1,
        transition: `opacity ${EXIT_MS}ms ${EASE_IN_CUBIC}`,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      {/* Resplandor detrás del logo: el mismo degradado que splash-glow.png de
          la app (#7C3AED con la misma caída de alfa), pero en CSS. */}
      <div
        style={{
          position: 'absolute',
          width: 'min(532px, 133vw)',
          aspectRatio: '1',
          borderRadius: '50%',
          background:
            'radial-gradient(closest-side, rgba(124,58,237,1) 0%, rgba(124,58,237,.75) 12.5%, rgba(124,58,237,.53) 25%, rgba(124,58,237,.35) 37.5%, rgba(124,58,237,.22) 50%, rgba(124,58,237,.11) 62.5%, rgba(124,58,237,.05) 75%, rgba(124,58,237,.01) 87.5%, rgba(124,58,237,0) 100%)',
          opacity: lit ? 0.9 : 0,
          transition: leaving ? 'opacity 350ms ease' : 'opacity 500ms cubic-bezier(0.33, 1, 0.68, 1)',
        }}
      />

      {/* Revelado del logo (isotipo + wordmark), fotograma a fotograma.
          Todos montados con opacidad 0 para que ya estén decodificados. */}
      <div
        style={{
          position: 'relative',
          width: 'min(280px, 70vw)',
          aspectRatio: '560 / 164',
          transform: leaving ? 'scale(1.18)' : 'scale(1)',
          opacity: leaving ? 0 : 1,
          transition: `transform 350ms ${EASE_IN_CUBIC}, opacity 280ms ease`,
        }}
      >
        {FRAMES.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- secuencia de fotogramas ya optimizada; next/image añadiría un srcset por fotograma
          <img
            key={src}
            ref={(el) => { frameRefs.current[i] = el }}
            src={src}
            alt=""
            width={560}
            height={164}
            decoding="sync"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0 }}
          />
        ))}
      </div>
    </div>
  )
}
