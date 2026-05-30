'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', label: 'Inicio',    match: (p: string) => p === '/',                                      icon: HomeIcon },
  { href: '/noticias',   label: 'Noticias',   match: (p: string) => p === '/noticias' || p.startsWith('/noticias/') || p.startsWith('/article'), icon: NewsIcon },
  { href: '/calendario', label: 'Calendario', match: (p: string) => p.startsWith('/calendario') || p.startsWith('/evento') || p.startsWith('/partido'), icon: CalIcon },
  { href: '/juegos',     label: 'Juegos',     match: (p: string) => ['/juegos','/predicciones','/quiniela','/mionce','/sopa-cracks','/crackquiz','/takagrid'].some(r => p.startsWith(r)), icon: GameIcon },
  { href: '/perfil',     label: 'Perfil',     match: (p: string) => p.startsWith('/perfil'), icon: UserIcon },
]

export default function BottomNav() {
  const pathname = usePathname() || '/'

  const onTap = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(8) } catch {}
    }
  }

  return (
    <nav
      aria-label="Navegación inferior"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 safe-bottom"
      style={{
        background: 'rgba(9,9,15,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <ul className="flex items-stretch justify-around" style={{ height: 64 }}>
        {TABS.map(({ href, label, match, icon: Icon }) => {
          const active = match(pathname)
          return (
            <li key={href} className="flex-1 relative">
              {/* Active top-pill indicator */}
              {active && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 28,
                    height: 2,
                    borderRadius: '0 0 2px 2px',
                    background: 'linear-gradient(90deg, #7C3AED, #A855F7)',
                    boxShadow: '0 0 6px rgba(124,58,237,0.6)',
                  }}
                />
              )}
              <Link
                href={href}
                onClick={onTap}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center justify-center gap-1 h-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)] focus-visible:ring-inset"
                style={{
                  color: active ? '#C4B5FD' : '#6A6A82',
                  textDecoration: 'none',
                }}
              >
                <span
                  className="flex items-center justify-center rounded-xl transition-all"
                  style={{
                    width: 36,
                    height: 26,
                    background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                  }}
                >
                  <Icon active={active} />
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sport)',
                    fontSize: 10,
                    fontWeight: active ? 700 : 600,
                    letterSpacing: '0.04em',
                  }}
                >
                  {label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill={active ? 'rgba(124,58,237,0.18)' : 'none'}>
      <path d="M3 10.5L11 4l8 6.5V18a1 1 0 0 1-1 1h-4v-5h-6v5H4a1 1 0 0 1-1-1v-7.5z"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function NewsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill={active ? 'rgba(124,58,237,0.18)' : 'none'}>
      <rect x="3.5" y="4.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 8h9M6.5 11h9M6.5 14h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function CalIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill={active ? 'rgba(124,58,237,0.18)' : 'none'}>
      <rect x="3.5" y="5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 9h15M7.5 3.5v3M14.5 3.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function GameIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill={active ? 'rgba(124,58,237,0.18)' : 'none'}>
      <rect x="2.5" y="6.5" width="17" height="10" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 11.5h3M8 10v3M14 10.5h.01M16 12.5h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill={active ? 'rgba(124,58,237,0.18)' : 'none'}>
      <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 19c0-3.5 3.2-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
