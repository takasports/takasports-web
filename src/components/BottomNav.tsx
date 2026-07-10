'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isLiveStatus } from '@/lib/live-events'

const TABS = [
  { href: '/', label: 'Inicio',    match: (p: string) => p === '/',                                      icon: HomeIcon },
  { href: '/noticias',   label: 'Noticias',   match: (p: string) => p === '/noticias' || p.startsWith('/noticias/') || p.startsWith('/article'), icon: NewsIcon },
  { href: '/calendario', label: 'Calendario', match: (p: string) => p.startsWith('/calendario') || p.startsWith('/evento') || p.startsWith('/partido'), icon: CalIcon, live: true },
  { href: '/predicciones', label: 'Predicciones', match: (p: string) => p.startsWith('/predicciones'), icon: PredIcon },
  { href: '/juegos',     label: 'Juegos',     match: (p: string) => ['/juegos','/quiniela','/mionce','/sopa-cracks','/crackquiz','/takagrid'].some(r => p.startsWith(r)), icon: GameIcon },
]

// Barra inferior FLOTANTE en vidrio (móvil, lg:hidden) — paridad con el tab bar de la
// app (foto de referencia estilo Instagram, aprobada por José Tomás): cápsula flotante
// con blur REAL (chrome fijo → permitido), SOLO ICONOS, pastilla activa MORADA de marca
// y punto rojo de directos en Calendario. Perfil NO es pestaña (vive en la cabecera).
export default function BottomNav() {
  const pathname = usePathname() || '/'
  const [hasLive, setHasLive] = useState(false)

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

  const onTap = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(8) } catch {}
    }
  }

  return (
    <nav
      aria-label="Navegación inferior"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none px-3.5"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}
    >
      {/* Wrapper con la sombra (sin overflow, que la recortaría) */}
      <div className="pointer-events-auto mx-auto" style={{ maxWidth: 460, borderRadius: 30, boxShadow: '0 18px 40px -14px rgba(0,0,0,0.7)' }}>
        {/* Cápsula: velo translúcido + blur real + canto de luz specular arriba */}
        <ul
          className="flex items-stretch justify-around overflow-hidden"
          style={{
            height: 58,
            borderRadius: 30,
            background: 'rgba(16,16,22,0.42)',
            backdropFilter: 'blur(30px) saturate(1.7)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.7)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.35)',
          }}
        >
          {TABS.map(({ href, label, match, icon: Icon, live }) => {
            const active = match(pathname)
            const showDot = !!live && hasLive
            return (
              <li key={href} className="flex-1 relative">
                <Link
                  href={href}
                  onClick={onTap}
                  aria-current={active ? 'page' : undefined}
                  aria-label={showDot ? `${label} (hay partidos en directo)` : label}
                  className="flex items-center justify-center h-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)] focus-visible:ring-inset"
                  style={{ color: active ? '#FFFFFF' : '#6A6A82', textDecoration: 'none' }}
                >
                  <span className="relative flex items-center justify-center" style={{ width: 54, height: 36 }}>
                    {/* Pastilla activa (morado de marca) */}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0"
                        style={{
                          borderRadius: 18,
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
                          background: '#FF3B3B',
                          border: '1.5px solid rgba(16,16,22,0.9)',
                        }}
                      />
                    )}
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

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 22 22" fill={active ? 'rgba(255,255,255,0.14)' : 'none'}>
      <path d="M3 10.5L11 4l8 6.5V18a1 1 0 0 1-1 1h-4v-5h-6v5H4a1 1 0 0 1-1-1v-7.5z"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function NewsIcon({ active }: { active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 22 22" fill={active ? 'rgba(255,255,255,0.14)' : 'none'}>
      <rect x="3.5" y="4.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.5 8h9M6.5 11h9M6.5 14h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
function CalIcon({ active }: { active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 22 22" fill={active ? 'rgba(255,255,255,0.14)' : 'none'}>
      <rect x="3.5" y="5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 9h15M7.5 3.5v3M14.5 3.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
function GameIcon({ active }: { active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 22 22" fill={active ? 'rgba(255,255,255,0.14)' : 'none'}>
      <rect x="2.5" y="6.5" width="17" height="10" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.5 11.5h3M8 10v3M14 10.5h.01M16 12.5h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
function PredIcon({ active }: { active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.7" fill={active ? 'rgba(255,255,255,0.14)' : 'none'} />
      <circle cx="11" cy="11" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="11" cy="11" r="0.7" fill="currentColor" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
