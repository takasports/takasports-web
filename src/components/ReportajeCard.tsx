import Link from 'next/link'
import Image from '@/components/DynamicImage'
import SportPlaceholder from '@/components/SportPlaceholder'
import { ReportajeSello, type Reportaje } from '@/components/ReportajesBlock'
import { urlFor } from '@/lib/sanity'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import { displayAuthor } from '@/lib/brand'
import { readingLabel } from '@/lib/reading'

// Tarjeta vertical del índice /reportajes. Mismo lenguaje que el bloque de la
// home (sello ámbar, firma y minutos), pero en rejilla y con la foto arriba.

export function coverUrl(r: Reportaje, w: number, h: number) {
  return r.imageUrl ?? (r.image?.asset ? urlFor(r.image).width(w).height(h).url() : null)
}

export default function ReportajeCard({ r, lcp }: { r: Reportaje; lcp?: boolean }) {
  const img = coverUrl(r, 720, 480)
  const { accent } = getSportStyle(r.sport, r.category)
  const label = getSportLabel(r.sport, r.category)
  const read = readingLabel(r.readChars)

  return (
    <Link
      href={`/noticias/${r.slug ?? r._id}`}
      className="group flex flex-col overflow-hidden rounded-2xl"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', textDecoration: 'none' }}
    >
      <div className="relative h-[190px]" style={{ background: '#06060F' }}>
        {img ? (
          <Image
            src={img}
            alt={r.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            priority={lcp}
            loading={lcp ? 'eager' : 'lazy'}
          />
        ) : (
          <SportPlaceholder sport={r.sport} category={r.category} emojiSize={52} />
        )}
      </div>

      <div className="flex flex-col flex-1 p-4">
        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
          <ReportajeSello compact />
          {label && (
            <span
              className="inline-block rounded font-black uppercase"
              style={{
                fontFamily: 'var(--font-sport)',
                fontSize: 8,
                letterSpacing: '0.14em',
                padding: '2px 6px',
                background: `${accent}26`,
                color: accent,
                border: `1px solid ${accent}48`,
              }}
            >
              {label}
            </span>
          )}
        </div>

        <h2
          className="font-black line-clamp-3 transition-colors group-hover:text-white"
          style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', lineHeight: 1.1, letterSpacing: '-0.018em', color: '#EDEDF7' }}
        >
          {r.title}
        </h2>

        {r.short_summary && (
          <p className="line-clamp-2 mt-2" style={{ fontSize: '0.84rem', lineHeight: 1.55, color: '#8E8EA6' }}>
            {r.short_summary}
          </p>
        )}

        <div
          className="flex items-center gap-2 flex-wrap mt-auto pt-3.5"
          style={{ fontFamily: 'var(--font-sport)', fontSize: 10, color: '#63637E', letterSpacing: '0.03em' }}
        >
          <span style={{ color: '#9A9AB4', fontWeight: 600 }}>{displayAuthor(r.author)}</span>
          {read && (
            <>
              <span className="w-[3px] h-[3px] rounded-full" style={{ background: '#3C3C52' }} />
              <span>{read}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
