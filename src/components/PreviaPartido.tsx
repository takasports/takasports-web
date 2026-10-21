// Las notas de Taka de un partido (previa y crónica) en la ficha /partido/[ref]:
// enlazadas por su matchRef exacto, nunca por texto. Viven en su propia pestaña
// «Notas» — antes la previa iba arriba del Resumen y tapaba las estadísticas, que es
// lo primero que busca quien abre la ficha [dueño, 21/10/2026]. Server component, sin
// JS: indexable aunque la pestaña esté oculta, y distribuye autoridad interna
// ficha → nota (la ficha recibe mucho más tráfico que la nota).

import Link from 'next/link'
import { sanityClient, notasByMatchRefQuery, urlFor } from '@/lib/sanity'
import { smallImage } from '@/lib/image-url'

export interface Previa {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  imageUrl?: string | null
  image?: { asset: { _ref: string } } | null
}

export type TipoNota = 'previa' | 'cronica'

export interface NotasPartido {
  previa: Previa | null
  cronica: Previa | null
}

const SIN_NOTAS: NotasPartido = { previa: null, cronica: null }

/** Previa y crónica del partido (solo las que tienen slug). Nunca lanza. */
export async function fetchNotasPartido(matchRef: string): Promise<NotasPartido> {
  const r = await sanityClient
    .fetch<{ previa: Previa | null; cronica: Previa | null } | null>(notasByMatchRefQuery, { ref: matchRef })
    .catch(() => null)
  if (!r) return SIN_NOTAS
  return {
    previa: r.previa?.slug ? r.previa : null,
    cronica: r.cronica?.slug ? r.cronica : null,
  }
}

const TEXTOS: Record<TipoNota, { etiqueta: string; leer: string }> = {
  previa: { etiqueta: 'La previa de Taka', leer: 'Leer la previa →' },
  cronica: { etiqueta: 'La crónica de Taka', leer: 'Leer la crónica →' },
}

export function PreviaPartidoCard({ previa, accent, tipo = 'previa' }: { previa: Previa; accent: string; tipo?: TipoNota }) {
  const textos = TEXTOS[tipo]

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
          {textos.etiqueta}
        </span>
        <span className="text-[16px] font-bold leading-snug">{previa.title}</span>
        {previa.short_summary && (
          <span className="line-clamp-2 text-[13px]" style={{ color: 'var(--body-lede, #9aa0aa)' }}>
            {previa.short_summary}
          </span>
        )}
        <span className="mt-1 text-[12.5px] font-bold" style={{ color: accent }}>{textos.leer}</span>
      </span>
    </Link>
  )
}
