'use client'

// El buscador de /buscar que responde al teclear (V-36, 5.6): hasta ahora había
// que pulsar Intro, y con «Lamine» escrito durante tres segundos la página no
// enseñaba nada. Ahora, igual que el buscador de la cabecera: a partir de dos
// letras pide partidos, jugadores y noticias y los pinta debajo de la caja.
//
// Lo que el servidor renderizó para `?q=` (facetas y resultados, indexables y
// sin JS) viaja como `children` y se enseña mientras lo tecleado sea la misma
// búsqueda; en cuanto cambia, mandan los resultados en vivo. Intro sigue
// llevando a la URL con la búsqueda, que es la que se comparte.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MatchHit } from '@/app/api/search/matches/route'
import type { SearchHit } from '@/app/api/search/players/route'
import { getSportLabel, getSportStyle } from '@/lib/sports'
import { timeAgo } from '@/lib/timeAgo'

interface ArticuloVivo {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  sport?: string
  category?: string
}

const LO_MAS_BUSCADO = ['Real Madrid', 'Barcelona', 'Lamine Yamal', 'Mbappé', 'Alcaraz', 'NBA', 'Champions', 'LaLiga', 'F1', 'UFC']

export default function BuscarLive({ initialQuery, children, sugerencias }: {
  initialQuery: string
  /** Lo que el servidor pintó para `initialQuery`. */
  children?: ReactNode
  /** Bloque de arranque (lo más leído) para cuando la caja está vacía. */
  sugerencias?: ReactNode
}) {
  const router = useRouter()
  const [q, setQ] = useState(initialQuery)
  const [cargando, setCargando] = useState(false)
  const [partidos, setPartidos] = useState<MatchHit[]>([])
  const [fichas, setFichas] = useState<SearchHit[]>([])
  const [articulos, setArticulos] = useState<ArticuloVivo[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const termino = q.trim()
  const esLaDelServidor = termino === initialQuery.trim()

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (termino.length < 2 || esLaDelServidor) { setCargando(false); return }
    setCargando(true)
    let cancelado = false
    debounce.current = setTimeout(async () => {
      try {
        const [c, p, m] = await Promise.all([
          fetch(`/api/search?q=${encodeURIComponent(termino)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/search/players?q=${encodeURIComponent(termino)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/search/matches?q=${encodeURIComponent(termino)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ])
        if (cancelado) return
        setArticulos(Array.isArray(c) ? c : (c?.articles ?? []))
        setFichas(p?.hits ?? [])
        setPartidos((m?.matches ?? []).slice(0, 5))
      } finally {
        if (!cancelado) setCargando(false)
      }
    }, 280)
    return () => { cancelado = true }
  }, [termino, esLaDelServidor])

  const ir = () => { if (termino.length >= 2) router.push(`/buscar?q=${encodeURIComponent(termino)}`) }
  const total = partidos.length + fichas.length + articulos.length

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); ir() }} className="mb-6" role="search">
        <div className="relative">
          <input
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Equipos, jugadores, partidos, noticias…"
            autoFocus
            autoComplete="off"
            className="w-full rounded-2xl px-5 py-4 pr-14 outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 16 }}
          />
          <button
            type="submit"
            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)] rounded-md"
            aria-label="Buscar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: 'var(--text-primary)' }} aria-hidden>
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
        </div>
      </form>

      {termino.length < 2 ? (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="section-label mb-3">Lo más buscado</h2>
            <div className="flex flex-wrap gap-2">
              {LO_MAS_BUSCADO.map((t) => (
                <button key={t} type="button" onClick={() => setQ(t)} className="ts-chip ts-chip--texto" style={{ color: 'var(--text-primary)' }}>
                  {t}
                </button>
              ))}
            </div>
          </section>
          {sugerencias}
        </div>
      ) : esLaDelServidor ? (
        children
      ) : (
        <div className="flex flex-col gap-8" aria-live="polite">
          {cargando && total === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Buscando…</p>
          )}
          {!cargando && total === 0 && (
            <div className="text-center py-12">
              <p className="font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Sin resultados para &ldquo;{termino}&rdquo;</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Prueba con otras palabras o navega por deporte desde la portada.</p>
            </div>
          )}
          {partidos.length > 0 && (
            <section>
              <h2 className="section-label mb-3">Partidos</h2>
              <div className="ts-lista">
                {partidos.map((p) => {
                  const marcador = p.jugado && p.homeScore != null && p.awayScore != null ? `${p.homeScore} – ${p.awayScore}` : null
                  return (
                    <Link key={p.id} href={p.matchRef ? `/partido/${p.matchRef}` : '/calendario'} prefetch={false} className="flex items-center gap-3 no-underline hover:bg-white/[0.03]" style={{ minHeight: 56, padding: '10px 14px' }}>
                      <span className="flex-shrink-0 tabular-nums" style={{ width: 56, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: marcador ? 16 : 18, color: marcador ? 'var(--text-primary)' : 'var(--green)' }}>
                        {marcador ?? p.time}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sport)' }}>{p.away ? `${p.home} – ${p.away}` : p.home}</span>
                        <span className="block text-[12px]" style={{ color: 'var(--text-muted)' }}>{p.comp}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
          {fichas.length > 0 && (
            <section>
              <h2 className="section-label mb-3">Jugadores y equipos</h2>
              <div className="ts-lista">
                {fichas.map((h) => (
                  <Link key={`${h.type}-${h.href}`} href={h.href} prefetch={false} className="flex items-center gap-3 no-underline hover:bg-white/[0.03]" style={{ minHeight: 52, padding: '8px 14px' }}>
                    {h.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.logo} alt="" width={24} height={24} style={{ objectFit: 'contain', flexShrink: 0 }} />
                    ) : (
                      <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: 'rgba(124,58,237,0.18)', color: '#C4B5FD' }}>{h.name.charAt(0)}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{h.name}</span>
                      <span className="block text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>{h.subtitle}</span>
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] flex-shrink-0" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>{h.type === 'team' ? 'Equipo' : 'Jugador'}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {articulos.length > 0 && (
            <section>
              <h2 className="section-label mb-3">Noticias</h2>
              <div className="flex flex-col gap-2">
                {articulos.map((a) => {
                  const { accent } = getSportStyle(a.sport, a.category)
                  return (
                    <Link key={a._id} href={`/noticias/${a.slug ?? a._id}`} className="news-card block rounded-2xl p-4 no-underline" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <span className="flex items-center gap-2 mb-1">
                        {(a.sport || a.category) && <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>{getSportLabel(a.sport, a.category)}</span>}
                        {a.publishedAt && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }} suppressHydrationWarning>{timeAgo(a.publishedAt)}</span>}
                      </span>
                      <span className="news-title block text-[15px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{a.title}</span>
                      {a.short_summary && <span className="block text-[13px] mt-1 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{a.short_summary}</span>}
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
          {total > 0 && (
            <button type="button" onClick={ir} className="self-start text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Ver todos los resultados →
            </button>
          )}
        </div>
      )}
    </>
  )
}
