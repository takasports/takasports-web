// Widget "Últimas noticias sobre X" para hubs de entidad (equipo, jugador,
// ranking, evento). Hace una query Sanity de matching ligero en title /
// headline / summary y muestra los resultados en cards compactos.
//
// Server component — sin JS cliente, render dentro del HTML inicial → indexable.
// Si la query no devuelve nada, renderiza null (no muestra sección vacía).
//
// Por qué es importante para SEO: distribuye autoridad interna desde el feed
// editorial a los hubs de entidad. Antes los hubs eran "stats islands" sin
// jugo del contenido principal del site.

import Link from 'next/link'
import Image from '@/components/DynamicImage'
import { sanityClient, articlesByEntityQuery, urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'

interface RelatedArticle {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  sport?: string
  imageUrl?: string | null
  image?: { asset: { _ref: string } } | null
}

interface Props {
  /** Nombre completo de la entidad. Ej: "Lamine Yamal", "Real Madrid". */
  entityName: string
  /** Encabezado mostrado. Default: "Últimas noticias sobre {entityName}" */
  heading?: string
  /** Máximo de artículos a pulleados. Default: 6 */
  limit?: number
  /** Estilo del wrapper. Default styling Taka. */
  className?: string
}

export default async function RelatedArticlesByEntity({
  entityName,
  heading,
  limit = 6,
  className,
}: Props) {
  const needle = `${entityName.trim().toLowerCase()}*`
  const articles = await sanityClient
    .fetch<RelatedArticle[]>(articlesByEntityQuery, { needle, limit })
    .catch(() => [] as RelatedArticle[])

  if (articles.length === 0) return null

  const title = heading ?? `Últimas noticias sobre ${entityName}`

  return (
    <section
      className={className ?? 'mt-10 pt-6'}
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span className="section-accent" />
        <h2
          className="section-label"
          style={{ fontFamily: 'var(--font-sport)', textTransform: 'uppercase' }}
        >
          {title}
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        {articles.map((a) => {
          if (!a.slug) return null
          const img = a.imageUrl ?? (a.image?.asset ? urlFor(a.image).width(96).height(64).url() : null)
          return (
            <Link
              key={a._id}
              href={`/noticias/${a.slug}`}
              prefetch={false}
              className="group flex gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/[0.04]"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              {img && (
                <div
                  className="rounded-lg overflow-hidden flex-shrink-0"
                  style={{ width: 72, height: 48, background: 'rgba(255,255,255,0.04)' }}
                >
                  <Image
                    src={img}
                    alt={a.title}
                    width={72}
                    height={48}
                    style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                  />
                </div>
              )}
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <h3
                  className="text-[13px] font-bold leading-snug line-clamp-2"
                  style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}
                >
                  {a.title}
                </h3>
                {a.publishedAt && (
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}
                  >
                    {timeAgo(a.publishedAt)}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
