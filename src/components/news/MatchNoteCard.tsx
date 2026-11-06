'use client'

// ─────────────────────────────────────────────────────────────────────────────
// MatchNoteCard — LA tarjeta de partido de las notas (previa y crónica).
//
// Maqueta 2 de noviembre (V-08, V-09): las notas de partido dejaban de verse
// bien porque su «foto» era la placa de Instagram (escudos partidos por el
// recorte, dos fechas, texto sobre texto). Ahora se pintan con una tarjeta
// propia en HTML: rótulo de competición en el color del deporte, etiqueta
// «Previa» o «Crónica», escudos, la hora o el marcador grande en Barlow
// Condensed y, debajo, el titular como en el resto de tarjetas. Es la misma
// pieza en portada, /noticias, hubs y dentro de la propia nota; la placa sigue
// existiendo solo para compartir (Open Graph e historias).
//
// Tres tamaños y una forma compacta:
//   · `lg`      — hero de la portada (escudos de 80 y hora de 76 en escritorio;
//                 48 y 44 en móvil).
//   · `md`      — primera tarjeta de /noticias y la cabecera de la nota.
//   · `sm`      — laterales del hero y segunda tarjeta de /noticias.
//   · `compact` — fila: cajita con escudos y marcador a la izquierda, rótulo y
//                 titular a la derecha («Resultados de esta noche», listados).
//
// Sin reloj: la fecha sale del instante del partido en Europe/Madrid con
// aritmética sobre el Y-M-D (nunca «Hoy», que depende de quién mira y rompía la
// hidratación en otros sitios); «Hoy · Leer artículo» usa timeAgo con
// suppressHydrationWarning como el resto de tarjetas.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import DynamicImage from '@/components/DynamicImage'
import type { PartidoDeNota } from '@/lib/notas-partido'
import { getSportStyle } from '@/lib/sports'
import { shortCompName } from '@/lib/calendar-competitions'
import { timeAgo } from '@/lib/timeAgo'

export interface MatchNoteArticle {
  _id?: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  sport?: string
  category?: string
  type?: string | null
  language?: string
  partido: PartidoDeNota
}

type Size = 'lg' | 'md' | 'sm'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** «Sáb 7 nov» en hora de España, sin depender de cómo nombre ICU los días. */
export function fechaCortaMadrid(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const y = get('year'), m = get('month'), day = get('day')
  if (!y || !m || !day) return null
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay()
  return `${DIAS[dow]} ${day} ${MESES[m - 1]}`
}

/** «21:00» en hora de España. */
export function horaMadrid(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const mi = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${h === '24' ? '00' : h}:${mi}`
}

/** Iniciales del escudo de respaldo: siglas de ESPN o las del nombre. */
function iniciales(nombre: string, abbr?: string): string {
  const a = (abbr ?? '').trim()
  if (a) return a.slice(0, 3).toUpperCase()
  const partes = nombre.split(/\s+/).filter(Boolean)
  if (partes.length === 1) return partes[0].slice(0, 3).toUpperCase()
  return partes.map((w) => w[0]).slice(0, 3).join('').toUpperCase()
}

function Escudo({ src, nombre, abbr, size, accent }: { src?: string; nombre: string; abbr?: string; size: number; accent: string }) {
  const [fallo, setFallo] = useState(false)
  if (src && !fallo) {
    return (
      <DynamicImage
        src={src}
        alt=""
        width={size}
        height={size}
        unoptimized
        onError={() => setFallo(true)}
        style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
      />
    )
  }
  // Nunca un hueco vacío: inicial sobre el color del deporte (§6.12).
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: `${accent}1A`, border: `1px solid ${accent}4D`, color: accent,
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: Math.max(11, Math.round(size * 0.34)), letterSpacing: '0.02em',
      }}
    >
      {iniciales(nombre, abbr)}
    </span>
  )
}

const LBL: CSSProperties = {
  fontFamily: 'var(--font-sport)', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
}

/** Lo que va en el centro: «21:00» o «1 – 0», y debajo «Sáb 7 nov · Mestalla» o «Final · Jue 5 nov». */
function centro(p: PartidoDeNota): { grande: string; pequeno: string; esMarcador: boolean } {
  const fecha = fechaCortaMadrid(p.iso)
  const hayMarcador = p.estado === 'final' && p.homeScore != null && p.awayScore != null
  if (hayMarcador) {
    return { grande: `${p.homeScore} – ${p.awayScore}`, pequeno: ['Final', fecha].filter(Boolean).join(' · '), esMarcador: true }
  }
  const hora = horaMadrid(p.iso) ?? '—'
  if (p.estado === 'final') {
    // Crónica sin marcador archivado: la hora y «Final», antes que inventar.
    return { grande: hora, pequeno: ['Final', fecha].filter(Boolean).join(' · '), esMarcador: false }
  }
  return { grande: hora, pequeno: [fecha, p.venue].filter(Boolean).join(' · '), esMarcador: false }
}

const ETIQUETA: Record<string, string> = { previa: 'Previa', cronica: 'Crónica' }

export function competicionDeTarjeta(a: Pick<MatchNoteArticle, 'partido' | 'category' | 'sport'>): string {
  if (a.partido.competicionCorta) return a.partido.competicionCorta
  const corta = shortCompName(a.partido.competicion ?? a.category, a.sport)
  return corta || a.category || ''
}

// Medidas por tamaño. Las de `lg` son las de escritorio; en móvil `lg` baja a
// las de `md` por CSS (clamp), que es lo que enseña la maqueta de la portada.
const MEDIDAS: Record<Size, { escudo: number; escudoMovil: number; nombre: number; hora: string; titulo: string; padX: number; padY: number; colEq: number }> = {
  lg: { escudo: 80, escudoMovil: 48, nombre: 16, hora: 'clamp(44px, 5.3vw, 76px)', titulo: 'clamp(22px, 2.8vw, 40px)', padX: 28, padY: 34, colEq: 120 },
  md: { escudo: 48, escudoMovil: 48, nombre: 13, hora: '44px', titulo: '22px', padX: 14, padY: 18, colEq: 88 },
  sm: { escudo: 40, escudoMovil: 40, nombre: 13, hora: '34px', titulo: '19px', padX: 14, padY: 18, colEq: 80 },
}

export default function MatchNoteCard({
  article,
  size = 'md',
  layout = 'card',
  titulo = true,
  entradilla,
  leer,
  asLink = true,
  className = '',
  style,
  prefetch,
  reveal = false,
}: {
  article: MatchNoteArticle
  size?: Size
  layout?: 'card' | 'compact'
  /** Titular y pie bajo el partido. `false` dentro de la propia nota. */
  titulo?: boolean
  /** Entradilla bajo el titular (solo el hero de escritorio). */
  entradilla?: boolean
  /** «Hoy · Leer artículo →» en vez de «Hoy · 4 min de lectura». */
  leer?: boolean
  asLink?: boolean
  className?: string
  style?: CSSProperties
  prefetch?: boolean
  /** Ver la nota de `reveal` en ArticleCard: solo bajo un contenedor con useScrollReveal. */
  reveal?: boolean
}) {
  const p = article.partido
  const { accent } = getSportStyle(article.sport, article.category)
  const comp = competicionDeTarjeta(article)
  // Una previa de un partido ya jugado no se anuncia como previa: la tarjeta da el resultado.
  const etiqueta = article.type === 'previa' && p?.estado === 'final' ? 'Jugado' : (ETIQUETA[article.type ?? ''] ?? 'Partido')
  const c = centro(p)
  const href = `/noticias/${article.slug ?? article._id ?? ''}`
  const m = MEDIDAS[size]

  const Fecha = article.publishedAt ? (
    <time dateTime={article.publishedAt} suppressHydrationWarning>{timeAgo(article.publishedAt, article.language)}</time>
  ) : null

  const envolver = (nodo: ReactNode, clase: string, estilo?: CSSProperties) =>
    asLink ? (
      <Link href={href} prefetch={prefetch} className={`${clase} block no-underline ${className}`} data-reveal={reveal ? '' : undefined} style={{ textDecoration: 'none', ...estilo, ...style }}>
        {nodo}
      </Link>
    ) : (
      <div className={`${clase} ${className}`} style={{ ...estilo, ...style }}>{nodo}</div>
    )

  if (layout === 'compact') {
    return envolver(
      <article className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col items-center gap-1 flex-shrink-0 rounded-xl py-2" style={{ width: 88, background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1.5">
            <Escudo src={p.homeLogo} nombre={p.home} abbr={p.homeAbbr} size={22} accent={accent} />
            <Escudo src={p.awayLogo} nombre={p.away} abbr={p.awayAbbr} size={22} accent={accent} />
          </div>
          <span className="whitespace-nowrap tabular-nums" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, lineHeight: 1, color: 'var(--text-primary)' }}>
            {c.grande}
          </span>
        </div>
        <div className="min-w-0">
          <p style={{ ...LBL, color: accent }}>{[comp, etiqueta].filter(Boolean).join(' · ')}</p>
          <h3 className="news-title line-clamp-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, lineHeight: 1.12, marginTop: 4, color: 'var(--text-primary)' }}>
            {article.title}
          </h3>
        </div>
      </article>,
      'news-card',
    )
  }

  const colEq = (lado: 'home' | 'away') => (
    <div className="mnc-eq flex flex-col items-center gap-2 min-w-0 flex-shrink-0">
      <span className="mnc-escudo inline-flex">
        <Escudo
          src={lado === 'home' ? p.homeLogo : p.awayLogo}
          nombre={lado === 'home' ? p.home : p.away}
          abbr={lado === 'home' ? p.homeAbbr : p.awayAbbr}
          size={m.escudo}
          accent={accent}
        />
      </span>
      <span className="text-center truncate w-full" style={{ fontFamily: 'var(--font-sport)', fontWeight: 600, fontSize: m.nombre, color: 'var(--text-primary)' }}>
        {lado === 'home' ? p.home : p.away}
      </span>
    </div>
  )

  return envolver(
    <article
      className="mnc overflow-hidden rounded-2xl h-full flex flex-col"
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        ['--mnc-col' as string]: `${m.colEq}px`, ['--mnc-col-movil' as string]: `${size === 'lg' ? 88 : m.colEq}px`,
        ['--mnc-escudo-movil' as string]: `${m.escudoMovil}px`,
        ['--mnc-pad-x' as string]: `${m.padX}px`, ['--mnc-pad-y' as string]: `${m.padY}px`,
      }}
    >
      <div className="flex items-center justify-between" style={{ height: 36, padding: `0 ${m.padX}px`, borderBottom: '1px solid var(--border)' }}>
        <span className="truncate" style={{ ...LBL, color: accent }}>{comp}</span>
        <span
          className="inline-flex items-center flex-shrink-0 rounded-full"
          style={{ ...LBL, height: 22, padding: '0 9px', background: 'var(--bg-surface)', border: '1px solid var(--border-2)', color: 'var(--text-primary)' }}
        >
          {etiqueta}
        </span>
      </div>

      <div className="mnc-cuerpo flex-1 flex items-center justify-between">
        {colEq('home')}
        <div className="text-center flex-1 min-w-0 px-1">
          <div
            className="tabular-nums whitespace-nowrap"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: m.hora, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}
          >
            {c.grande}
          </div>
          <div className="truncate" style={{ ...LBL, marginTop: 6, color: 'var(--text-secondary)' }}>{c.pequeno}</div>
        </div>
        {colEq('away')}
      </div>

      {titulo && (
        <div style={{ padding: `14px ${m.padX}px 16px`, borderTop: '1px solid var(--border)' }}>
          <h2 className="news-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: m.titulo, lineHeight: 1.08, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            {article.title}
          </h2>
          {entradilla && article.short_summary && (
            <p className="line-clamp-2" style={{ marginTop: 10, fontSize: 16, lineHeight: 1.45, color: 'var(--text-secondary)', maxWidth: '62ch' }}>
              {article.short_summary}
            </p>
          )}
          {(Fecha || leer) && (
            <p style={{ marginTop: leer && entradilla ? 14 : 8, fontSize: leer ? 13 : 12, color: 'var(--text-muted)' }}>
              {Fecha}
              {leer ? (
                <>
                  {Fecha ? ' · ' : ''}
                  <span style={{ color: '#C4B5FD', fontWeight: 600 }}>Leer artículo →</span>
                </>
              ) : null}
            </p>
          )}
        </div>
      )}
    </article>,
    'news-card',
  )
}
