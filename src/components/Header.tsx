'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { sanityClient, searchArticlesQuery, urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'

const INNER = 'max-w-[1440px] mx-auto px-6 xl:px-10'

const NAV_LINKS = [
  { label: 'Inicio',     href: '/'          },
  { label: 'Noticias',   href: '/noticias'  },
  { label: 'Calendario', href: '/calendario'},
  { label: 'Quiniela',   href: '/quiniela'  },
  { label: 'Juegos',     href: '/juegos'    },
]

function isNavActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

interface SearchArticle {
  _id: string
  title: string
  publishedAt?: string
  sport?: string
  category?: string
  image?: { asset: { _ref: string } }
}

// ── Search Modal ─────────────────────────────────────────────
function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [articles, setArticles] = useState<SearchArticle[]>([])
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    sanityClient.fetch<SearchArticle[]>(searchArticlesQuery).then((data) => {
      setArticles(data ?? [])
      setLoading(false)
    })
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const results = query.trim().length < 2
    ? []
    : articles.filter((a) =>
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.sport?.toLowerCase().includes(query.toLowerCase()) ||
        a.category?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
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
            placeholder="Buscar artículos, deportes..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#EBEBF5', fontFamily: 'var(--font-geist-sans)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: '#5A5A6A', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.07)', color: '#5A5A6A' }}>
            Esc
          </button>
        </div>

        {/* Resultados */}
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {loading && (
            <div className="px-4 py-8 text-center text-sm" style={{ color: '#4A4A5A' }}>Cargando...</div>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
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
          {results.length > 0 && (
            <div className="py-1">
              {results.map((article) => {
                const imgUrl = article.image?.asset ? urlFor(article.image).width(120).height(80).url() : null
                const label = article.sport ?? article.category
                return (
                  <Link
                    key={article._id}
                    href={`/article/${article._id}`}
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
            {loading ? 'Cargando índice...' : `${articles.length} artículos indexados`}
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

  useEffect(() => { setMenuOpen(false) }, [pathname])

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
        <div className={`${INNER} flex items-center h-14 gap-6`}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0" style={{ textDecoration: 'none' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7C3AED 0%,#4F46E5 100%)' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 1.5L10 6L2.5 10.5V1.5Z" fill="white" />
              </svg>
            </div>
            <span className="text-[20px] font-black" style={{ fontFamily: 'var(--font-display)', color: '#F0F0F5', letterSpacing: '-0.01em' }}>
              Taka<span style={{ color: '#8B5CF6' }}>Sports</span>
            </span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {NAV_LINKS.map(({ label, href }) => {
              const active = isNavActive(href, pathname)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link relative flex items-center px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap${active ? ' active' : ''}`}
                  style={{ fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
                >
                  {label}
                  {active && (
                    <span style={{
                      position: 'absolute', bottom: 0, left: '50%',
                      transform: 'translateX(-50%)',
                      width: 18, height: 2,
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
              className="search-bar hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#4A4A5A' }}
            >
              <SearchIcon />
              <span className="text-xs" style={{ color: '#4A4A5A' }}>Buscar artículos...</span>
              <kbd className="hidden md:block text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', color: '#3A3A4A' }}>
                ⌘K
              </kbd>
            </button>

            <button
              aria-label="Mi perfil"
              className="profile-btn flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: 34, height: 34, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.22)', color: '#9B7CF6' }}
            >
              <ProfileIcon />
            </button>

            {/* Hamburger */}
            <button
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ width: 34, height: 34, background: menuOpen ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
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
          <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="drawer-panel">
            <div style={{ background: 'rgba(13,13,20,0.98)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-6 py-4 flex flex-col gap-1">

                {/* Search */}
                <button
                  onClick={() => { setMenuOpen(false); openSearch() }}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl mb-1"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#4A4A5A', fontFamily: 'var(--font-sport)', fontSize: 14, fontWeight: 600, textAlign: 'left' }}
                >
                  <SearchIcon />
                  <span>Buscar artículos...</span>
                </button>

                {NAV_LINKS.map(({ label, href }) => {
                  const active = isNavActive(href, pathname)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
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

                <button
                  className="flex items-center gap-3 px-3 py-3 rounded-xl w-full text-left"
                  style={{ color: '#9090A4', fontFamily: 'var(--font-sport)', fontSize: 15, fontWeight: 600 }}
                >
                  <ProfileIcon />
                  <span>Mi perfil</span>
                </button>
              </div>
            </div>
          </nav>
        </>
      )}

      {searchOpen && <SearchModal onClose={closeSearch} />}
    </>
  )
}
