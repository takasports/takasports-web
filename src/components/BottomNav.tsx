'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useMounted } from '@/hooks/useMounted'
import { isLiveStatus } from '@/lib/live-events'

const JUEGOS_ROUTES = ['/juegos', '/predicciones', '/quiniela', '/mionce', '/sopa-cracks', '/crackquiz', '/takagrid', '/liga-taka', '/badges']

const TABS = [
  { href: '/', label: 'Inicio', match: (p: string) => p === '/', icon: HomeIcon },
  { href: '/noticias', label: 'Noticias', match: (p: string) => p === '/noticias' || p.startsWith('/noticias/') || p.startsWith('/article'), icon: NewsIcon },
  { href: '/calendario', label: 'Partidos', match: (p: string) => p.startsWith('/calendario') || p.startsWith('/evento') || p.startsWith('/partido'), icon: CalIcon, live: true },
  // "Jugar" reúne Predicciones y Juegos, que competían por dos pestañas de
  // cinco. Entra por /predicciones —la Jornada es lo que trae de vuelta— y
  // marca activo en todo el recinto de juego, minijuegos y Liga Taka incluidos.
  { href: '/predicciones', label: 'Jugar', match: (p: string) => JUEGOS_ROUTES.some(r => p.startsWith(r)), icon: PredIcon },
  // `sinPrefetch`: /perfil es la ÚNICA ruta de la barra que se declara
  // force-dynamic (necesita el nonce de la CSP por petición, ver el layout de
  // /perfil). Next prefetchea por defecto todo Link que esté en pantalla, y esta
  // barra está siempre en pantalla en móvil: eso disparaba DOS peticiones RSC a
  // /perfil en cada carga de cada página, que el navegador acababa abortando
  // (ERR_ABORTED) porque una ruta dinámica no se puede guardar en la caché del
  // router. Coste: dos renders de servidor por visita, a cambio de nada.
  { href: '/perfil', label: 'Tú', match: (p: string) => p.startsWith('/perfil'), icon: PersonIcon, sinPrefetch: true },
]

// Barra inferior FLOTANTE en vidrio (móvil, md:hidden): cápsula con blur real,
// pastilla activa morada de marca y punto rojo de directos en Partidos.
//
// Rediseñada el 03/09/2026 (fase 1, opción A aprobada por José Tomás). Antes eran
// cinco iconos SIN una sola palabra —la diana era Predicciones y el mando Juegos,
// pero había que adivinarlo— y el perfil vivía escondido en la cabecera, que es
// justo donde no se vuelve. Ahora:
//   · cada pestaña lleva su palabra debajo del icono;
//   · "Jugar" reúne Predicciones y Juegos, que gastaban dos de las cinco plazas;
//   · "Tú" sube el perfil (racha, puntos, avisos, guardados) a la barra.
// Reels, Rankings y Estadísticas siguen en el cajón ☰ y en el pie.
export default function BottomNav() {
  // La pestaña activa se marca SOLO tras hidratar, y no es un capricho: en
  // algunas regeneraciones ISR de la portada el `usePathname()` del servidor no
  // devuelve exactamente '/', así que el HTML cacheado salía sin ninguna
  // pestaña marcada mientras el cliente sí marcaba "Inicio". Esa diferencia es
  // ESTRUCTURAL (la pastilla activa es un <span> que aparece o no) y vive en el
  // layout raíz, fuera del Suspense de la página: React tiraba el documento
  // ENTERO —cabecera incluida, duplicando el <style> de layout.tsx— y repintaba
  // la portada en cliente (error #418).
  //
  // Solo le pasaba a Inicio porque su `match` es una igualdad exacta
  // (`p === '/'`); las demás pestañas usan `startsWith` y aguantan un pathname
  // ligeramente distinto. Aun así el guard va en TODAS: el fallo es del reloj
  // ajeno —lo que el servidor cree que es la ruta—, no de esta pestaña.
  //
  // Coste: el primer pintado del HTML no lleva pestaña resaltada y aparece al
  // hidratar. Es preferible a servir una marcada MAL, que es lo que pasaba.
  const pathname = usePathname() || '/'
  const montado = useMounted()
  const [hasLive, setHasLive] = useState(false)
  const capsuleRef = useRef<HTMLDivElement | null>(null)

  // Directos para el punto rojo del Calendario. Poll cada 60s, en pausa con la pestaña
  // oculta (batería/red), igual criterio que el resto del polling de la web.
  useEffect(() => {
    let alive = true
    const poll = async () => {
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        const res = await fetch('/api/events/live', { cache: 'no-store' })
        const data = await res.json()
        const fixtures: { status?: string }[] = Array.isArray(data) ? data : (data?.events ?? data?.fixtures ?? [])
        if (alive) setHasLive(fixtures.some((f) => isLiveStatus(f.status)))
      } catch { /* red caída → sin badge */ }
    }
    poll()
    const id = setInterval(poll, 60_000)
    const onVis = () => { if (!document.hidden) poll() }
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // La cápsula ENCOGE mientras se hace scroll (arriba o abajo) y vuelve al parar —
  // paridad con el tab bar de la app (useTabBarChrome). Se muta el estilo a mano
  // (sin re-render por frame) con un debounce que la restaura ~560 ms tras cesar
  // el scroll. Respeta prefers-reduced-motion.
  useEffect(() => {
    const el = capsuleRef.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return

    let shrunk = false
    let restore: ReturnType<typeof setTimeout> | null = null

    const onScroll = () => {
      if (!shrunk) {
        shrunk = true
        el.style.transition = 'transform 170ms ease, opacity 170ms ease'
        el.style.transform = 'translateY(8px) scale(0.88)'
        el.style.opacity = '0.66'
      }
      if (restore) clearTimeout(restore)
      restore = setTimeout(() => {
        shrunk = false
        el.style.transition = 'transform 320ms ease, opacity 320ms ease'
        el.style.transform = ''
        el.style.opacity = ''
      }, 560)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (restore) clearTimeout(restore)
    }
  }, [])

  const onTap = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(8) } catch {}
    }
  }

  return (
    <nav
      aria-label="Navegación inferior"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none px-3.5"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}
    >
      {/* Wrapper con la sombra (sin overflow, que la recortaría) */}
      <div ref={capsuleRef} className="pointer-events-auto mx-auto" style={{ maxWidth: 460, borderRadius: 22, boxShadow: '0 18px 40px -14px rgba(0,0,0,0.7)', willChange: 'transform', transformOrigin: 'center bottom' }}>
        {/* Cápsula: velo translúcido + blur real + canto de luz specular arriba */}
        <ul
          className="flex items-stretch justify-around overflow-hidden"
          style={{
            height: 66,
            borderRadius: 22,
            // La cápsula es vidrio (42% de opacidad) y eso funciona sobre el
            // fondo oscuro del sitio. Con el modo lectura claro encendido, al
            // llegar al cuerpo del artículo la barra queda FLOTANDO SOBRE PAPEL:
            // el fondo efectivo se vuelve claro y sus etiquetas (#8A8A9C y el
            // blanco de la activa) caen a 1,17:1 y 2,88:1. Medido con axe en
            // producción, 5 incumplimientos. Con el claro encendido la cápsula
            // se vuelve opaca y oscura: sigue siendo chrome del sitio, que es
            // oscuro, y recupera el contraste. [04/09/2026]
            background: 'var(--ts-bottomnav-bg, rgba(16,16,22,0.42))',
            backdropFilter: 'blur(30px) saturate(1.7)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.7)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.35)',
          }}
        >
          {TABS.map(({ href, label, match, icon: Icon, live, sinPrefetch }) => {
            const active = montado && match(pathname)
            const showDot = !!live && hasLive
            return (
              <li key={href} className="flex-1 relative">
                <Link
                  href={href}
                  prefetch={sinPrefetch ? false : undefined}
                  onClick={onTap}
                  aria-current={active ? 'page' : undefined}
                  aria-label={showDot ? `${label} (hay partidos en directo)` : label}
                  className="flex flex-col items-center justify-center gap-[3px] h-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)] focus-visible:ring-inset"
                  style={{ color: active ? '#FFFFFF' : 'var(--text-muted)', textDecoration: 'none' }}
                >
                  <span className="relative flex items-center justify-center" style={{ width: 50, height: 26 }}>
                    {/* Pastilla activa (morado de marca) */}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0"
                        style={{
                          borderRadius: 14,
                          background: 'rgba(167,139,250,0.20)',
                          border: '1px solid rgba(167,139,250,0.32)',
                          boxShadow: '0 0 14px rgba(124,58,237,0.22)',
                        }}
                      />
                    )}
                    <span className="relative flex items-center justify-center"><Icon active={active} /></span>
                    {/* Punto rojo de directos */}
                    {showDot && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 10,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#FF4D2E',
                          border: '1.5px solid rgba(16,16,22,0.9)',
                        }}
                      />
                    )}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-sport)',
                      fontSize: 9.5,
                      fontWeight: active ? 700 : 600,
                      letterSpacing: '0.045em',
                      lineHeight: '10px',
                      display: 'block',
                      color: active ? '#FFFFFF' : 'var(--text-muted)',
                    }}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 22 22" fill={active ? 'rgba(255,255,255,0.14)' : 'none'}>
      <circle cx="11" cy="7.6" r="3.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 18.5c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 22 22" fill={active ? 'rgba(255,255,255,0.14)' : 'none'}>
      <path d="M3 10.5L11 4l8 6.5V18a1 1 0 0 1-1 1h-4v-5h-6v5H4a1 1 0 0 1-1-1v-7.5z"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function NewsIcon({ active }: { active: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 22 22" fill={active ? 'rgba(255,255,255,0.14)' : 'none'}>
      <rect x="3.5" y="4.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.5 8h9M6.5 11h9M6.5 14h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
function CalIcon({ active }: { active: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 22 22" fill={active ? 'rgba(255,255,255,0.14)' : 'none'}>
      <rect x="3.5" y="5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 9h15M7.5 3.5v3M14.5 3.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
function GameIcon({ active }: { active: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 22 22" fill={active ? 'rgba(255,255,255,0.14)' : 'none'}>
      <rect x="2.5" y="6.5" width="17" height="10" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.5 11.5h3M8 10v3M14 10.5h.01M16 12.5h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
function PredIcon({ active }: { active: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.7" fill={active ? 'rgba(255,255,255,0.14)' : 'none'} />
      <circle cx="11" cy="11" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="11" cy="11" r="0.7" fill="currentColor" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
