// "La previa de Taka" en la ficha del partido: la nota previa enlazada por su
// matchRef exacto. Va arriba del Resumen, que es lo primero que ve quien entra a la
// ficha antes del partido. Server component, sin JS: indexable, y distribuye
// autoridad interna ficha → nota (la ficha recibe mucho más tráfico que la nota).
// Si el partido no tiene previa, no pinta nada.

import Link from 'next/link'
import { sanityClient, previaByMatchRefQuery, urlFor } from '@/lib/sanity'
import { smallImage } from '@/lib/image-url'

export interface Previa {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  imageUrl?: string | null
  image?: { asset: { _ref: string } } | null
}

export default async function PreviaPartido({ matchRef, accent = '#34D399' }: { matchRef: string; accent?: string }) {
  const previa = await sanityClient
    .fetch<Previa | null>(previaByMatchRefQuery, { ref: matchRef })
    .catch(() => null)
  if (!previa?.slug) return null
  return <PreviaPartidoCard previa={previa} accent={accent} />
}

export function PreviaPartidoCard({ previa, accent }: { previa: Previa; accent: string }) {

  const img = previa.imageUrl
    ? smallImage(previa.imageUrl, 720) ?? null
    : previa.image?.asset ? urlFor(previa.image).width(720).height(405).url() : null

  return (
    <Link
      href={`/noticias/${previa.slug}`}
      prefetch={false}
      className="mb-6 flex flex-col overflow-hidden rounded-2xl sm:flex-row"
      style={{ border: `1px solid ${accent}33`, background: `${accent}0d` }}
    >
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="aspect-video w-full object-cover sm:w-64 sm:shrink-0 sm:self-center" loading="lazy" />
      )}
      <span className="flex flex-col gap-1.5 px-5 py-4">
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: accent, fontFamily: 'var(--font-sport)' }}
        >
          La previa de Taka
        </span>
        <span className="text-[16px] font-bold leading-snug">{previa.title}</span>
        {previa.short_summary && (
          <span className="line-clamp-2 text-[13px]" style={{ color: 'var(--body-lede, #9aa0aa)' }}>
            {previa.short_summary}
          </span>
        )}
        <span className="mt-1 text-[12.5px] font-bold" style={{ color: accent }}>Leer la previa →</span>
      </span>
    </Link>
  )
}
