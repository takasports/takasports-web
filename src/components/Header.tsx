'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { LogoFull } from './Logo'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { createClient } from '@/lib/supabase'
import { trackSearch } from '@/lib/analytics'
import type { User } from '@supabase/supabase-js'
import { PersonIcon } from '@/components/icons/GameIcons'
import type { SearchHit } from '@/app/api/search/players/route'
import dynamic from 'next/dynamic'

const AuthModal = dynamic(() => import('./AuthModal'), { ssr: false })

const INNER = 'max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10'

const NAV_LINKS = [
  { label: 'Inicio',       href: '/'              },
  { label: 'Noticias',     href: '/noticias'      },
  { label: 'Calendario',   href: '/calendario'    },
  { label: 'Estadísticas', href: '/estadisticas'  },
  { label: 'Rankings',     href: '/rankings'      },
  { label: 'Juegos',       href: '/juegos'        },
  { label: 'Quiniela',     href: '/quiniela'      },
]

function isNavActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

interface SearchArticle {
  _id: string
  slug?: string
  title: string
  publishedAt?: string
  sport?: string
  category?: string
  image?: { asset: { _ref: string } }
}

interface SearchPlayer {
  id: string
  name: string
  subtitle: string
  category: string
  sport: string
  score: number
  rank: number
  emoji?: string
  photo?: string
  catLabel: string
}

const SPORT_ACCENT: Record<string, string> = {
  futbol: '#22C55E', baloncesto: '#F97316', formula1: '#EF4444',
  tenis: '#EAB308', contenido: '#7C3AED',
}

function playerRankingsUrl(player: SearchPlayer, q: string): string {
  const tab = player.category === 'jugadoras' ? 'jugadoras'
    : player.category === 'sub21' ? 'jugadores'
    : player.category === 'latam' ? 'jugadores'
    : player.category === 'concacaf' ? 'jugadores'
    : player.category
  const params = new URLSearchParams({ tab, q })
  if (player.category === 'sub21') params.set('scope', 'sub21')
  if (player.category === 'latam') params.set('scope', 'pais')
  if (player.category === 'concacaf') params.set('scope', 'concacaf')
  return `/rankings?${params.toString()}`
}

// ── Search Modal ─────────────────────────────────────────────
function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [articles, setArticles] = useState<SearchArticle[]>([])
  const [players, setPlayers] = useState<SearchPlayer[]>([])
  const [espnHits, setEspnHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setArticles([])
      setPlayers([])
      setEspnHits([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      trackSearch(q)
      try {
        const [contentRes, espnRes] = await Promise.all([
          fetch(`/api/search?q=${encodeURIComponent(q)}`),
          fetch(`/api/search/players?q=${encodeURIComponent(q)}`),
        ])
        if (contentRes.ok) {
          const data = await contentRes.json()
          if (Array.isArray(data)) { setArticles(data); setPlayers([]) }
          else { setArticles(data.articles ?? []); setPlayers(data.players ?? []) }
        }
        if (espnRes.ok) {
          const d = await espnRes.json()
          setEspnHits(d.hits ?? [])
        } else { setEspnHits([]) }
      } catch {
        setArticles([])
        setPlayers([])
        setEspnHits([])
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const totalResults = articles.length + players.length + espnHits.length

  return (
    <div className="search-overlay" onClick={onClose} aria-hidden="true">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en TakaSports"
        className="search-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" style={{ color: '#5A5A6A', flexShrink: 0 }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jugadores, noticias, deportes..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#EBEBF5', fontFamily: 'var(--font-geist-sans)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda" style={{ color: '#5A5A6A', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button onClick={onClose} aria-label="Cerrar búsqueda" className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.07)', color: '#5A5A6A' }}>
            Esc
          </button>
        </div>

        {/* Resultados */}
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          {loading && (
            <div className="px-4 py-8 text-center text-sm" style={{ color: '#4A4A5A' }}>Buscando...</div>
          )}
          {!loading && query.trim().length >= 2 && totalResults === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: '#5A5A6A' }}>
                Sin resultados para &ldquo;<span style={{ color: '#9090A4' }}>{query}</span>&rdquo;
              </p>
            </div>
          )}
          {!loading && query.trim().length < 2 && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: '#3A3A4A' }}>
              Escribe al menos 2 caracteres para buscar
            </div>
          )}

          {/* Jugadores y equipos (ESPN) — fichas con stats reales */}
          {espnHits.length > 0 && (
            <div className="pt-2 pb-1" style={{ borderBottom: (players.length || articles.length) ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div className="px-4 pb-1">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#5A5A6A' }}>
                  Jugadores y equipos
                </span>
              </div>
              {espnHits.map(h => (
                <Link key={`${h.type}-${h.href}`} href={h.href} onClick={onClose}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.04]">
                  {h.logo ? (
                    <Image src={h.logo} alt="" width={22} height={22} unoptimized
                      style={{ objectFit: 'contain', flexShrink: 0 }} />
                  ) : (
                    <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={{ background: 'rgba(124,58,237,0.18)', color: '#C4B5FD' }}>
                      {h.name.charAt(0)}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: '#EBEBF5' }}>{h.name}</div>
                    <div className="text-[10px] truncate" style={{ color: '#7A7A8E' }}>{h.subtitle}</div>
                  </div>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: h.type === 'team' ? 'rgba(34,197,94,0.15)' : 'rgba(124,58,237,0.18)',
                             color: h.type === 'team' ? '#4ade80' : '#C4B5FD' }}>
                    {h.type === 'team' ? 'Equipo' : 'Jugador'}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Jugadores */}
          {players.length > 0 && (
            <div className="pt-2 pb-1">
              <div className="px-4 pb-1">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#5A5A6A' }}>
                  Rankings
                </span>
              </div>
              {players.map((player) => {
                const accent = SPORT_ACCENT[player.sport] ?? '#7C3AED'
                return (
                  <Link
                    key={player.id}
                    href={playerRankingsUrl(player, query.trim())}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-white/5"
                    style={{ textDecoration: 'none' }}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center text-base"
                      style={{ width: 38, height: 38, background: `${accent}18`, border: `1px solid ${accent}30` }}>
                      {player.photo
                        ? <Image src={player.photo} alt={player.name} width={34} height={34} className="w-full h-full object-cover" />
                        : <span style={{ color: accent }}>{player.emoji ?? <PersonIcon size={20} />}</span>
                      }
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: '#EBEBF5' }}>
                        {player.name}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: '#5A5A6A' }}>
                        {player.subtitle}
                      </p>
                    </div>
                    {/* Score + badge */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                      <span className="text-[11px] font-black tabular-nums" style={{ color: accent }}>
                        {Number(player.score).toFixed(1)}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ background: `${accent}15`, color: accent }}>
                        {player.catLabel}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Separador */}
          {players.length > 0 && articles.length > 0 && (
            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 16px' }} />
          )}

          {/* Artículos */}
          {articles.length > 0 && (
            <div className="pt-2 pb-1">
              {players.length > 0 && (
                <div className="px-4 pb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#5A5A6A' }}>
                    Noticias
                  </span>
                </div>
              )}
              {articles.map((article) => {
                const imgUrl = article.image?.asset ? urlFor(article.image).width(120).height(80).url() : null
                const label = article.sport ?? article.category
                return (
                  <Link
                    key={article._id}
                    href={`/noticias/${article.slug ?? article._id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5"
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 48, height: 36, background: 'linear-gradient(145deg,#1a1a2e,#09090F)' }}>
                      {imgUrl && <Image src={imgUrl} alt={article.title} width={48} height={36} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      {label && (
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}>
                          {label}
                        </span>
                      )}
                      <p className="text-[13px] font-medium leading-snug truncate" style={{ color: '#EBEBF5' }}>
                        {article.title}
                      </p>
                    </div>
                    {article.publishedAt && (
                      <span className="text-[10px] flex-shrink-0" style={{ color: '#4A4A5A' }}>
                        {timeAgo(article.publishedAt)}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-[10px]" style={{ color: '#3A3A4A' }}>
            {loading ? 'Buscando...' : totalResults > 0 ? `${totalResults} resultado${totalResults !== 1 ? 's' : ''}` : 'Escribe para buscar'}
          </span>
          <span className="text-[10px]" style={{ color: '#3A3A4A' }}>↵ abrir · Esc cerrar</span>
        </div>
      </div>
    </div>
  )
}

// ── Iconos ──────────────────────────────────────────────────
function ProfileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 17.5c0-3.314 2.91-6 6.5-6s6.5 2.686 6.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

// ── Header principal ─────────────────────────────────────────
export default function Header() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    document.body.style.overflow = (menuOpen || searchOpen) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen, searchOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  return (
    <>
      <header
        className="sticky top-0 z-50 w-full"
        style={{
          background: 'rgba(9,9,15,0.94)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className={`${INNER} flex items-center h-14 gap-4`}>

          {/* Logo */}
          <LogoFull size={30} />

          {/* Nav desktop */}
          <nav className="hidden lg:flex items-center gap-0 flex-1" aria-label="Navegación principal">
            {NAV_LINKS.map(({ label, href }) => {
              const active = isNavActive(href, pathname)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`nav-link relative flex items-center px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap${active ? ' active' : ''}`}
                  style={{ fontFamily: 'var(--font-sport)', textDecoration: 'none', letterSpacing: '0.01em' }}
                >
                  {label}
                  {active && (
                    <span style={{
                      position: 'absolute', bottom: 0, left: '50%',
                      transform: 'translateX(-50%)',
                      width: 16, height: 2,
                      background: '#7C3AED', borderRadius: 1,
                    }} />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              aria-label="Buscar"
              onClick={openSearch}
              className="search-bar hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:border-white/15"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#7A7A8E' }}
            >
              <SearchIcon />
              <span className="text-xs" style={{ color: '#7A7A8E' }}>Buscar jugadores, noticias...</span>
              <kbd className="hidden md:block text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#5A5A6E' }}>
                ⌘K
              </kbd>
            </button>

            {/* Search icon — solo visible en < xl */}
            <button
              aria-label="Buscar"
              onClick={openSearch}
              className="xl:hidden flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#7A7A8E' }}
            >
              <SearchIcon />
            </button>

            {user ? (
              <Link
                href="/perfil"
                aria-label="Mi perfil"
                className="profile-btn flex items-center justify-center rounded-full flex-shrink-0 overflow-hidden"
                style={{ width: 38, height: 38, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)', textDecoration: 'none' }}
              >
                {user.user_metadata?.avatar_url ? (
                  <Image
                    src={user.user_metadata.avatar_url as string}
                    alt={user.user_metadata?.full_name ?? 'Avatar'}
                    width={34} height={34}
                    className="object-cover w-full h-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span
                    className="text-xs font-black"
                    style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}
                  >
                    {((user.user_metadata?.full_name ?? user.email ?? 'U') as string)
                      .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                  </span>
                )}
              </Link>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                aria-label="Iniciar sesión"
                className="profile-btn flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 38, height: 38, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.22)', color: '#9B7CF6', cursor: 'pointer' }}
              >
                <ProfileIcon />
              </button>
            )}
            {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

            {/* Hamburger */}
            <button
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              onClick={() => setMenuOpen((v) => !v)}
              className="lg:hidden flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ width: 38, height: 38, background: menuOpen ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {menuOpen ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2L12 12M12 2L2 12" stroke="#9B7CF6" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                  <rect y="0" width="16" height="2" rx="1" fill="#8E8E9E" />
                  <rect x="2" y="5" width="12" height="2" rx="1" fill="#8E8E9E" />
                  <rect y="10" width="16" height="2" rx="1" fill="#8E8E9E" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <nav className="drawer-panel" aria-label="Menú de navegación">
            <div style={{ background: 'rgba(13,13,20,0.98)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-4 sm:px-6 py-4 flex flex-col gap-1">

                {/* Search */}
                <button
                  onClick={() => { setMenuOpen(false); openSearch() }}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl mb-1"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#4A4A5A', fontFamily: 'var(--font-sport)', fontSize: 14, fontWeight: 600, textAlign: 'left' }}
                >
                  <SearchIcon />
                  <span>Buscar jugadores, noticias...</span>
                </button>

                {NAV_LINKS.map(({ label, href }) => {
                  const active = isNavActive(href, pathname)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className="flex items-center justify-between px-3 py-3 rounded-xl transition-all"
                      style={{
                        background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                        color: active ? '#C4B5FD' : '#9090A4',
                        fontFamily: 'var(--font-sport)',
                        fontSize: 15,
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <span>{label}</span>
                      {active && <span style={{ width: 6, height: 6, background: '#7C3AED', borderRadius: '50%', display: 'block' }} />}
                    </Link>
                  )
                })}

                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

                <Link
                  href="/perfil"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl w-full"
                  style={{ color: '#9090A4', fontFamily: 'var(--font-sport)', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}
                >
                  <ProfileIcon />
                  <span>Mi perfil</span>
                </Link>
              </div>
            </div>
          </nav>
        </>
      )}

      {searchOpen && <SearchModal onClose={closeSearch} />}
    </>
  )
}
