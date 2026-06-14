'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { LogoFull } from './Logo'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { trackSearch } from '@/lib/analytics'
import type { User } from '@supabase/supabase-js'
import { PersonIcon } from '@/components/icons/GameIcons'
import PorraCTA from '@/components/PorraCTA'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { SearchHit } from '@/app/api/search/players/route'
import dynamic from 'next/dynamic'

const AuthModal = dynamic(() => import('./AuthModal'), { ssr: false })

const INNER = 'max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10'

const NAV_LINKS = [
  { label: 'Inicio',       href: '/'              },
  { label: 'Noticias',     href: '/noticias'      },
  { label: 'Reels',        href: '/reels'         },
  { label: 'Calendario',   href: '/calendario'    },
  { label: 'Estadísticas', href: '/estadisticas'  },
  { label: 'Rankings',     href: '/rankings'      },
  { label: 'Juegos',       href: '/juegos'        },
]

const PORRA_LINK = { label: 'Predicciones', href: '/predicciones' }

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
  const modalRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Atrapa el Tab dentro del modal (ya tiene su propio Escape + foco inicial al input)
  useFocusTrap(true, modalRef, onClose, { initialFocus: false, escape: false })

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
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en TakaSports"
        className="search-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
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
            <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button onClick={onClose} aria-label="Cerrar búsqueda" className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}>
            Esc
          </button>
        </div>

        {/* Resultados */}
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          {loading && (
            <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Buscando...</div>
          )}
          {!loading && query.trim().length >= 2 && totalResults === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Sin resultados para &ldquo;<span style={{ color: '#9090A4' }}>{query}</span>&rdquo;
              </p>
            </div>
          )}
          {!loading && query.trim().length < 2 && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Escribe al menos 2 caracteres para buscar
            </div>
          )}

          {/* Jugadores y equipos (ESPN) — fichas con stats reales */}
          {espnHits.length > 0 && (
            <div className="pt-2 pb-1" style={{ borderBottom: (players.length || articles.length) ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div className="px-4 pb-1">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
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
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
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
                        ? <Image src={player.photo} alt={player.name} width={34} height={34} unoptimized className="w-full h-full object-cover" />
                        : <span style={{ color: accent }}>{player.emoji ?? <PersonIcon size={20} />}</span>
                      }
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: '#EBEBF5' }}>
                        {player.name}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
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
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
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
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
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
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {loading ? 'Buscando...' : totalResults > 0 ? `${totalResults} resultado${totalResults !== 1 ? 's' : ''}` : 'Escribe para buscar'}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>↵ abrir · Esc cerrar</span>
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

// ── Level chip (XP compacto en el header) ───────────────────
interface LevelData {
  level:      number
  levelName:  string
  levelColor: string
  progress:   number   // 0–1
  xp:         number
  xpToNext:   number
}

function LevelChip({ data }: { data: LevelData }) {
  const pct = Math.round(data.progress * 100)
  const tooltip = data.xpToNext > 0
    ? `${data.xp.toLocaleString()} XP · Faltan ${data.xpToNext.toLocaleString()} para L${data.level + 1}`
    : `${data.xp.toLocaleString()} XP · Nivel máximo`
  return (
    <Link
      href="/perfil"
      aria-label={`Nivel ${data.level} — ${data.levelName}`}
      title={tooltip}
      style={{ textDecoration: 'none' }}
      className="hidden md:flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-opacity hover:opacity-80 flex-shrink-0"
    >
      {/* Nivel + nombre */}
      <div className="flex items-center gap-1">
        <span
          className="text-[9px] font-black tabular-nums leading-none"
          style={{ color: data.levelColor, fontFamily: 'var(--font-sport)', letterSpacing: '0.04em' }}
        >
          L{data.level}
        </span>
        <span
          className="text-[8px] font-semibold leading-none hidden lg:inline"
          style={{ color: data.levelColor, opacity: 0.75, fontFamily: 'var(--font-sport)', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {data.levelName}
        </span>
      </div>
      {/* Barra XP */}
      <div
        style={{
          width: 48,
          height: 3,
          background: 'rgba(255,255,255,0.07)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: data.levelColor,
            borderRadius: 999,
            boxShadow: `0 0 6px ${data.levelColor}90`,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
    </Link>
  )
}

// ── Toast de level-up ─────────────────────────────────────────
function LevelUpToast({ level, levelName, color, onClose }: {
  level: number; levelName: string; color: string; onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: 'rgba(15,15,20,0.97)',
        border: `1.5px solid ${color}`,
        borderRadius: 14,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: `0 4px 32px ${color}40, 0 0 0 1px rgba(255,255,255,0.04)`,
        animation: 'slideUp 0.35s cubic-bezier(.17,.67,.35,1.2) both',
        maxWidth: 280,
      }}
    >
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <span style={{ fontSize: 28, lineHeight: 1 }}>⬆️</span>
      <div>
        <div style={{ color, fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 13, letterSpacing: '0.04em' }}>
          ¡SUBISTE DE NIVEL!
        </div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
          Ahora eres <strong style={{ color }}>{levelName}</strong> (L{level})
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label="Cerrar"
        style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
      >×</button>
    </div>
  )
}

// ── Header principal ─────────────────────────────────────────
// Sugerencias que rota el buscador visible (desktop xl+). Tras "Buscar ".
const SEARCH_HINTS = ['jugadores, noticias…', 'a Mbappé', 'la NBA', 'el Mundial 2026', 'LaLiga', 'a Alcaraz']

// `sticky` (default true): el Header se fija él mismo al top. En la consola de
// (public) se monta con sticky={false} porque el contenedor de la consola es
// quien se fija (Header + LiveStrip como bloque único). home/calendario montan
// <Header /> directo = sticky propio, sin tocar.
export default function Header({ sticky = true }: { sticky?: boolean } = {}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [levelData, setLevelData] = useState<LevelData | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [levelUpToast, setLevelUpToast] = useState<{ level: number; levelName: string; color: string } | null>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  // Subrayado magnético: una sola línea que se desliza bajo el enlace de sección
  // activo (en vez de un subrayado fijo por enlace). Se mide con getBoundingClientRect.
  const [navLine, setNavLine] = useState<{ left: number; width: number; top: number; ready: boolean }>({ left: 0, width: 0, top: 0, ready: false })

  // Pinta el último nivel conocido AL INSTANTE desde localStorage (sin esperar
  // a auth + /api/quiniela/me). Evita que la barra XP "salte" al entrar. Se
  // refresca con datos reales en cuanto resuelve el fetch; se limpia al cerrar sesión.
  const LEVELCHIP_CACHE = 'ts_levelchip'
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LEVELCHIP_CACHE)
      if (cached) setLevelData(JSON.parse(cached) as LevelData)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    // Supabase se carga de forma DIFERIDA (dynamic import) para sacar
    // @supabase/ssr + supabase-js (~60-70 KiB gzip) del First Load. El Header
    // está montado en todas las páginas, así que esto aligera TODA la web. El
    // level chip ya pinta desde cache localStorage (ts_levelchip) → sin parpadeo.
    // El cleanup de useEffect debe ser síncrono: guardamos la subscription en
    // una variable mutable y un flag `cancelled` cubre el desmontaje durante la
    // carga del chunk.
    let subscription: { unsubscribe: () => void } | null = null
    let cancelled = false
    import('@/lib/supabase').then(({ createClient }) => {
      if (cancelled) return
      const supabase = createClient()
      if (!supabase) return
      supabase.auth.getUser().then(({ data }) => { setUser(data.user ?? null); setAuthChecked(true) })
      subscription = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null); setAuthChecked(true)
      }).data.subscription
    })
    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [])

  // Fetch level data cuando hay sesión — con detección de level-up
  useEffect(() => {
    if (!user) {
      // Solo limpiamos (y borramos la caché) cuando la auth YA se resolvió a
      // "sin sesión". Mientras carga, conservamos el valor optimista de caché.
      if (authChecked) {
        setLevelData(null)
        try { localStorage.removeItem(LEVELCHIP_CACHE) } catch { /* ignore */ }
      }
      return
    }
    const LEVEL_KEY = `ts_level_${user.id}`
    fetch('/api/quiniela/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((d: { level?: number; levelName?: string; levelColor?: string; progress?: number; xp?: number; xpToNext?: number } | null) => {
        if (d && d.level != null) {
          const newLevel = d.level
          const newData: LevelData = {
            level:      newLevel,
            levelName:  d.levelName  ?? '',
            levelColor: d.levelColor ?? '#A78BFA',
            progress:   d.progress   ?? 0,
            xp:         d.xp         ?? 0,
            xpToNext:   d.xpToNext   ?? 0,
          }
          setLevelData(newData)
          try { localStorage.setItem(LEVELCHIP_CACHE, JSON.stringify(newData)) } catch { /* ignore */ }

          // Detectar level-up comparando con el nivel anterior guardado
          try {
            const prevLevel = parseInt(sessionStorage.getItem(LEVEL_KEY) ?? '0', 10)
            if (prevLevel > 0 && newLevel > prevLevel) {
              // ¡Subió de nivel! Mostrar toast
              setLevelUpToast({ level: newLevel, levelName: newData.levelName, color: newData.levelColor })
            }
            sessionStorage.setItem(LEVEL_KEY, String(newLevel))
          } catch { /* sessionStorage no disponible — ignorar */ }
        }
      })
      .catch(() => {/* silencioso */})
  }, [user])

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
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  // Buscador visible (xl+): placeholder rotativo que sugiere búsquedas. Respeta
  // prefers-reduced-motion (no rota). El modal real se abre con click o ⌘K.
  const [hintIdx, setHintIdx] = useState(0)
  const [hintShown, setHintShown] = useState(true)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      setHintShown(false)
      window.setTimeout(() => {
        setHintIdx((i) => (i + 1) % SEARCH_HINTS.length)
        setHintShown(true)
      }, 220)
    }, 3400)
    return () => clearInterval(id)
  }, [])

  // Drawer móvil: atrapa el foco, Escape cierra, y devuelve el foco a la
  // hamburguesa al cerrar (patrón WAI-ARIA para menús desplegables).
  useFocusTrap(menuOpen, drawerRef, closeMenu, { returnRef: hamburgerRef })

  // Mide la posición del enlace activo para el subrayado magnético. La línea
  // se desliza al nuevo enlace al navegar (transición CSS gateada por capacidad).
  useEffect(() => {
    const measure = () => {
      const nav = navRef.current
      if (!nav) return
      const active = nav.querySelector<HTMLElement>('a[aria-current="page"]')
      if (!active) { setNavLine(l => (l.ready ? { ...l, ready: false } : l)); return }
      const navRect = nav.getBoundingClientRect()
      const r = active.getBoundingClientRect()
      const inset = 8
      setNavLine({
        left: r.left - navRect.left + inset,
        width: Math.max(0, r.width - inset * 2),
        top: r.bottom - navRect.top - 2,
        ready: true,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    // ResizeObserver del nav: re-mide en cuanto el nav obtiene/cambia su ancho
    // real (cubre el reflow por carga de fuentes web y cualquier cambio de layout).
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && navRef.current) {
      ro = new ResizeObserver(measure)
      ro.observe(navRef.current)
    }
    // Las fuentes web cambian el ancho de los enlaces al cargar → re-medir.
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {})
    }
    return () => { window.removeEventListener('resize', measure); ro?.disconnect() }
  }, [pathname])

  return (
    <>
      <header
        className={`${sticky ? 'sticky top-0 z-50' : 'relative z-40'} w-full`}
        style={{
          background: 'rgba(9,9,15,0.94)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className={`${INNER} flex items-center h-14 gap-4`}>

          {/* Logo */}
          <LogoFull
            size={30}
            onClick={pathname === '/' ? () => window.scrollTo({ top: 0, behavior: 'smooth' }) : undefined}
          />

          {/* Nav desktop */}
          <nav ref={navRef} className="hidden lg:flex items-center gap-0 flex-1 relative" aria-label="Navegación principal">
            {NAV_LINKS.map(({ label, href }) => {
              const active = isNavActive(href, pathname)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`nav-link relative flex items-center px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap${active ? ' active' : ''}`}
                  style={{ fontFamily: 'var(--font-sport)', textDecoration: 'none', letterSpacing: '0.01em' }}
                  onClick={href === '/' && pathname === '/' ? () => window.scrollTo({ top: 0, behavior: 'smooth' }) : undefined}
                >
                  {label}
                </Link>
              )
            })}

            {/* Porra CTA — pill destacada con badge dinámico (jornada/deadline/picks) */}
            <PorraCTA
              href={PORRA_LINK.href}
              active={isNavActive(PORRA_LINK.href, pathname)}
              variant="desktop"
            />

            {/* Subrayado magnético: una sola línea que se desliza al enlace de
                sección activo. Teñida del deporte (cae a morado), con glow señal. */}
            <span
              aria-hidden="true"
              className="ts-navline"
              style={{
                position: 'absolute',
                top: navLine.top,
                left: navLine.left,
                width: navLine.width,
                height: 2,
                borderRadius: 1,
                background: 'var(--sport-accent, #7C3AED)',
                boxShadow: '0 0 8px color-mix(in srgb, var(--sport-accent, #7C3AED) 55%, transparent)',
                opacity: navLine.ready ? 1 : 0,
                pointerEvents: 'none',
              }}
            />
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Buscador. En pantallas anchas (xl+) = barra visible con placeholder
                rotativo + atajo ⌘K. En el resto = lupa compacta (sin saturar). */}
            <button
              aria-label="Buscar en TakaSports"
              onClick={openSearch}
              title="Buscar (⌘K)"
              className="hidden xl:flex items-center gap-2 rounded-lg flex-shrink-0 transition-colors hover:border-white/15"
              style={{ height: 38, width: 232, padding: '0 8px 0 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#7A7A8E' }}
            >
              <SearchIcon />
              <span
                className="text-[13px] flex-1 text-left truncate"
                style={{ opacity: hintShown ? 1 : 0, transition: 'opacity 200ms ease' }}
              >
                Buscar {SEARCH_HINTS[hintIdx]}
              </span>
              <kbd
                className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ fontFamily: 'inherit', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#9090A4' }}
              >
                ⌘K
              </kbd>
            </button>
            <button
              aria-label="Buscar"
              onClick={openSearch}
              title="Buscar (⌘K)"
              className="flex xl:hidden items-center justify-center rounded-lg flex-shrink-0 transition-colors hover:border-white/15"
              style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#7A7A8E' }}
            >
              <SearchIcon />
            </button>

            {/* Level + XP chip — solo para usuarios autenticados */}
            {levelData && <LevelChip data={levelData} />}

            {user ? (
              <Link
                href="/perfil"
                aria-label={levelData ? `Mi perfil — nivel ${levelData.level}` : 'Mi perfil'}
                className="profile-btn relative flex items-center justify-center flex-shrink-0"
                style={{ width: 40, height: 40, textDecoration: 'none' }}
              >
                {/* Anillo de progreso de nivel — solo en móvil (en md+ ya está el LevelChip) */}
                {levelData && (
                  <svg
                    className="md:hidden"
                    width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"
                    style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
                  >
                    <circle cx="20" cy="20" r="18.5" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2.5" />
                    <circle
                      cx="20" cy="20" r="18.5" fill="none"
                      stroke={levelData.levelColor} strokeWidth="2.5" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 18.5}
                      strokeDashoffset={2 * Math.PI * 18.5 * (1 - Math.min(1, Math.max(0, levelData.progress)))}
                    />
                  </svg>
                )}
                {/* Avatar */}
                <span
                  className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
                  style={{ width: 34, height: 34, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)' }}
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
                </span>
                {/* Insignia de nivel — solo móvil (en md+ el nivel va en el LevelChip) */}
                {levelData && (
                  <span
                    className="md:hidden"
                    aria-hidden="true"
                    style={{
                      position: 'absolute', bottom: -2, right: -1,
                      background: levelData.levelColor, color: '#09090F',
                      fontSize: 8, fontWeight: 900, lineHeight: 1.5,
                      padding: '0 3px', borderRadius: 5,
                      border: '1.5px solid #09090F', fontFamily: 'var(--font-sport)',
                    }}
                  >
                    L{levelData.level}
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
              ref={hamburgerRef}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              aria-controls="mobile-drawer"
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
          <nav ref={drawerRef} id="mobile-drawer" tabIndex={-1} className="drawer-panel" aria-label="Menú de navegación" style={{ outline: 'none' }}>
            <div style={{ background: 'rgba(13,13,20,0.98)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-4 sm:px-6 py-4 flex flex-col gap-1">

                {/* Search */}
                <button
                  onClick={() => { setMenuOpen(false); openSearch() }}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl mb-1"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', fontSize: 14, fontWeight: 600, textAlign: 'left' }}
                >
                  <SearchIcon />
                  <span>Buscar jugadores, noticias...</span>
                </button>

                {/* Porra CTA mobile — destacada arriba con badge dinámico */}
                <PorraCTA
                  href={PORRA_LINK.href}
                  active={isNavActive(PORRA_LINK.href, pathname)}
                  variant="mobile"
                  onNavigate={() => setMenuOpen(false)}
                />

                {NAV_LINKS.map(({ label, href }) => {
                  const active = isNavActive(href, pathname)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => {
                        setMenuOpen(false)
                        if (href === '/' && pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
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

                {user && levelData && (
                  <Link
                    href="/perfil"
                    onClick={() => setMenuOpen(false)}
                    style={{ textDecoration: 'none' }}
                    className="flex flex-col gap-1.5 px-4 py-3 border-t mt-1"
                    aria-label={`Nivel ${levelData.level} — ${levelData.levelName}`}
                  >
                    <div className="flex items-center justify-between">
                      <span style={{ color: levelData.levelColor, fontWeight: 900, fontSize: 12, fontFamily: 'var(--font-sport)', letterSpacing: '0.04em' }}>
                        L{levelData.level} · {levelData.levelName}
                      </span>
                      <span style={{ color: 'rgba(167,139,250,0.4)', fontSize: 10, fontFamily: 'var(--font-sport)' }}>
                        {levelData.xp.toLocaleString('es-ES')} XP
                      </span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 3, overflow: 'hidden', width: '100%' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, levelData.progress * 100)}%`,
                          background: levelData.levelColor,
                          borderRadius: 4,
                          boxShadow: `0 0 4px ${levelData.levelColor}80`,
                        }}
                      />
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </nav>
        </>
      )}

      {searchOpen && <SearchModal onClose={closeSearch} />}

      {/* Toast de level-up — portal al nivel de página */}
      {levelUpToast && (
        <LevelUpToast
          level={levelUpToast.level}
          levelName={levelUpToast.levelName}
          color={levelUpToast.color}
          onClose={() => setLevelUpToast(null)}
        />
      )}
    </>
  )
}
