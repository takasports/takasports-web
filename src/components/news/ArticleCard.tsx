'use client'

// ─────────────────────────────────────────────────────────────────────────────
// ArticleCard — LA tarjeta de noticia. Una sola.
//
// Antes había cinco filas distintas para enseñar lo mismo (NewsFeed,
// NewsPageFeed, NewsSidebar, MasLeidas, MatchNews/RelatedArticlesByEntity), más
// dos rejillas, repartidas en diez componentes y ~2.600 líneas. No era solo
// duplicación estética: al copiarse iban perdiendo cosas por el camino.
//
//   · El `Thumb` de NewsPageFeed era el de NewsFeed MENOS el `onError`, así que
//     una foto rota dejaba un hueco en /noticias y el escudo del deporte en el
//     feed de portada.
//   · NewsPageFeed pintaba la fecha en un `<p>` en vez del `<time dateTime>` que
//     usa NewsFeed: legible para una persona, opaco para Google, que es quien
//     ordena y fecha las noticias.
//
// Las dos cosas se arreglan aquí de una vez, para todos los sitios.
//
// La API va por VARIANTE + TAMAÑO, con los valores por defecto que ya usaba cada
// sitio; solo se pasa lo que de verdad difiere (el número de «Lo más leído», la
// fila sin foto del lateral de /noticias).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useMounted } from '@/hooks/useMounted'
import Link from 'next/link'
import Image from '@/components/DynamicImage'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import SportPlaceholder from '@/components/SportPlaceholder'
import { ReportajeSello } from '@/components/ReportajesBlock'

/** Lo mínimo que necesita la tarjeta. Cada pantalla declara su propio `Article`
 *  (hay diez interfaces iguales en el repo); estructuralmente todas encajan. */
export interface ArticleCardData {
  /** Opcional: «Lo más leído» viene de Search Console y solo trae el slug. */
  _id?: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  type?: string
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

/** Ventana de la píldora «Nuevo». Estaba escrita tres veces (dos como
 *  `7_200_000` y una como `2 * 60 * 60 * 1000`); siempre valió lo mismo.
 *
 *  ⚠️ Decide con el reloj del NAVEGADOR: llamarla en el primer render rompe la
 *  hidratación. La portada y /noticias van con `revalidate = 300`, así que el
 *  HTML puede llegar cinco minutos rancio; un artículo que cruce las 2 h entre
 *  el render cacheado y la hidratación sale CON badge en el servidor y SIN él
 *  en el cliente, React descarta el árbol y repinta la página entera (#418).
 *  Por eso aquí va detrás de `useMounted()`, y quien la use fuera debe hacer lo
 *  mismo — ver `ee32a1f`. */
export const VENTANA_NUEVO_MS = 2 * 60 * 60 * 1000

export function esNuevo(publishedAt?: string): boolean {
  if (!publishedAt) return false
  return Date.now() - new Date(publishedAt).getTime() < VENTANA_NUEVO_MS
}

type Variant = 'row' | 'grid'
type Size = 'sm' | 'md'

// Medidas por variante+tamaño. `req` es lo que se le pide a Sanity, no lo que se
// pinta: la miniatura de una fila ocupa 88 px, así que pedir 400 era tirar bytes.
const MEDIDAS = {
  'row-md':  { req: { w: 240, h: 168 }, box: 'w-[88px] h-[64px] lg:w-[120px] lg:h-[84px]', sizes: '(max-width: 1024px) 88px, 120px' },
  'row-sm':  { req: { w: 128, h: 88 },  box: 'w-16 h-11',                                   sizes: '64px' },
  'grid-md': { req: { w: 400, h: 220 }, box: '',                                            sizes: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px' },
  'grid-sm': { req: { w: 400, h: 220 }, box: '',                                            sizes: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px' },
} as const

function Thumb({
  url, title, w, h, sizes, sport, category,
}: {
  url: string | null; title: string; w: number; h: number; sizes: string; sport?: string; category?: string
}) {
  // El fallback al escudo del deporte es la razón de que esto sea un componente
  // con estado y no una `<Image>` suelta. Es la línea que se perdió al copiarse.
  const [failed, setFailed] = useState(false)
  return url && !failed ? (
    <Image
      src={url}
      alt={title}
      width={w}
      height={h}
      sizes={sizes}
      className="w-full h-full object-cover"
      // Recorte al 30% y no centrado: estas fotos NO son nuestras —medido en
      // /noticias, 0 de 33 vienen de Sanity, así que no hay foco que marcar— y
      // en una foto de prensa la cara está casi siempre en el tercio superior.
      // Centrado, el recorte decapitaba a media portada. [04/09/2026]
      style={{ objectPosition: 'center 30%' }}
      onError={() => setFailed(true)}
    />
  ) : (
    <SportPlaceholder sport={sport} category={category} />
  )
}

export default function ArticleCard({
  article,
  variant = 'row',
  size = 'md',
  rank,
  thumb,
  kicker,
  badgeNuevo,
  summary,
  fecha = true,
  gridImageHeight = 120,
  gridImageAspect,
  className = '',
  prefetch,
  reveal = false,
}: {
  article: ArticleCardData
  variant?: Variant
  /** `md` = fila de feed (88→120 px). `sm` = fila compacta de lateral o bloque. */
  size?: Size
  /** Posición 1..N. La pinta delante del título («Lo más leído», «Tendencias»). */
  rank?: number
  /** Por defecto sí; `false` para la fila sin foto del lateral de /noticias. */
  thumb?: boolean
  /** Etiqueta del deporte con su acento. Por defecto en `md` y en rejilla. */
  kicker?: boolean
  /** Píldora «Nuevo» (menos de 2 h). Por defecto solo en `md`. */
  badgeNuevo?: boolean
  /** Entradilla, solo a partir de `lg`. Por defecto solo en `row md`. */
  summary?: boolean
  fecha?: boolean
  /** Alto de la foto en rejilla: 120 en portada, 110 en /noticias. */
  gridImageHeight?: number
  /** Proporción en vez de alto fijo (p. ej. '16 / 10' en /archivo, donde la
   *  tarjeta es ancha y un alto fijo dejaba la foto pequeña). Manda sobre
   *  `gridImageHeight`. */
  gridImageAspect?: string
  className?: string
  prefetch?: boolean
  /** Marca la tarjeta para la animación de entrada al hacer scroll.
   *  SOLO donde un contenedor con `useScrollReveal` la va a revelar: el CSS deja
   *  `[data-reveal]` a `opacity: 0` hasta que alguien le pone `.revealed`, así
   *  que ponerlo en un bloque sin observador —el lateral de /noticias, «Lo más
   *  leído», las noticias del partido— deja la tarjeta INVISIBLE para siempre. */
  reveal?: boolean
}) {
  // El badge «Nuevo» solo puede decidirse DESPUÉS de montar (ver `esNuevo`).
  const montado = useMounted()
  const key = `${variant}-${size}` as keyof typeof MEDIDAS
  const m = MEDIDAS[key]

  // Valores por defecto = lo que ya hacía cada sitio antes de unificar.
  const conThumb  = thumb      ?? true
  const conKicker = kicker     ?? (variant === 'grid' || size === 'md')
  const conNuevo  = badgeNuevo ?? (variant === 'row' && size === 'md')
  const conSummary = summary   ?? (variant === 'row' && size === 'md')

  const imgUrl = article.imageUrl
    ?? (article.image?.asset ? urlFor(article.image).width(m.req.w).height(m.req.h).url() : null)
  const label = conKicker ? getSportLabel(article.sport, article.category) : null
  const { accent } = getSportStyle(article.sport, article.category)
  const href = `/noticias/${article.slug ?? article._id ?? ''}`

  const Kicker = label ? (
    <span
      className={`${size === 'sm' ? 'text-[8px]' : 'text-[9px]'} font-black uppercase tracking-widest`}
      style={{ color: accent, fontFamily: 'var(--font-sport)' }}
    >
      {label}
    </span>
  ) : null

  const Fecha = fecha && article.publishedAt ? (
    // <time dateTime> y no <p>: «hace 2 h» lo entiende una persona, la fecha
    // exacta en formato máquina la entiende Google, que es quien ordena noticias.
    <time
      dateTime={article.publishedAt}
      className={`block ${variant === 'grid' ? 'text-[10px] mt-2' : 'text-[10px] mt-1'}`}
      style={{ color: 'var(--text-faint)' }}
      suppressHydrationWarning
    >
      {timeAgo(article.publishedAt)}
    </time>
  ) : null

  const Titulo = (
    <h3
      className={`news-title ${size === 'sm' ? 'text-[12.5px]' : variant === 'grid' ? 'text-xs' : 'text-[13px]'} font-semibold leading-snug line-clamp-2`}
      style={{ color: 'var(--text-primary)' }}
    >
      {article.title}
    </h3>
  )

  if (variant === 'grid') {
    return (
      <Link
        href={href}
        prefetch={prefetch}
        className={`news-card tk-glass rounded-xl overflow-hidden block ${className}`}
        data-reveal={reveal ? '' : undefined}
        style={{ textDecoration: 'none' }}
      >
        <div className="overflow-hidden" style={gridImageAspect ? { aspectRatio: gridImageAspect } : { height: gridImageHeight }}>
          <Thumb url={imgUrl} title={article.title} w={m.req.w} h={m.req.h} sizes={m.sizes} sport={article.sport} category={article.category} />
        </div>
        <div className="p-3">
          {Kicker}
          <div className={label ? 'mt-0.5' : ''}>{Titulo}</div>
          {Fecha}
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={`news-card tk-glass flex ${size === 'sm' ? 'gap-3 p-2.5 items-center' : 'gap-3.5 p-3'} rounded-xl ${className}`}
      data-reveal={reveal ? '' : undefined}
      style={{ textDecoration: 'none' }}
    >
      {rank != null && (
        <span
          aria-hidden="true"
          className="font-black leading-none flex-shrink-0 w-5 text-center self-center"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            letterSpacing: '-0.02em',
            color: rank === 1 ? accent : 'var(--text-faint)',
          }}
        >
          {rank}
        </span>
      )}

      {conThumb && (
        <div className={`flex-shrink-0 rounded-lg overflow-hidden ${m.box}`}>
          <Thumb url={imgUrl} title={article.title} w={m.req.w} h={m.req.h} sizes={m.sizes} sport={article.sport} category={article.category} />
        </div>
      )}

      <div className={`flex flex-col ${size === 'sm' ? 'justify-center' : 'justify-between'} flex-1 min-w-0 ${size === 'sm' ? '' : 'py-0.5'}`}>
        <div>
          {(label || conNuevo || article.type === 'reportaje') && (
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {Kicker}
              {conNuevo && montado && esNuevo(article.publishedAt) && (
                <span
                  className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(124,58,237,0.18)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.25)' }}
                >
                  Nuevo
                </span>
              )}
              {article.type === 'reportaje' && <ReportajeSello compact />}
            </div>
          )}
          {Titulo}
          {conSummary && article.short_summary && (
            <p className="text-[11px] leading-relaxed mt-0.5 line-clamp-1 hidden lg:block" style={{ color: 'var(--text-muted)' }}>
              {article.short_summary}
            </p>
          )}
        </div>
        {Fecha}
      </div>
    </Link>
  )
}
