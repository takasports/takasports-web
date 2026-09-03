import Link from 'next/link'
import DynamicImage from '@/components/DynamicImage'
import { getMostRead } from '@/lib/most-read'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import { urlFor } from '@/lib/sanity'

// Bloque "Lo más leído de la semana".
//
// Hasta el 03/09/2026 no había NINGÚN módulo de popularidad en toda la web. Lo
// que /noticias llamaba "Tendencias" eran los artículos 6.º a 11.º de la misma
// lista ordenada por fecha: ninguna señal real.
//
// Se llama "de la semana" a propósito: la fuente es Search Console, cuya ventana
// termina hace tres días, así que un notición de ayer no sale. Ver lib/most-read.
//
// Si no hay datos —credencial caída, ventana vacía, artículos despublicados— no
// se pinta nada. Un bloque vacío es peor que ningún bloque.
export default async function MasLeidas({
  limite = 5,
  excluirSlug,
  titulo = 'Lo más leído de la semana',
}: {
  limite?: number
  /** El artículo que se está leyendo, para no ofrecerse a sí mismo. */
  excluirSlug?: string
  titulo?: string
}) {
  const todas = await getMostRead(limite + 1)
  const articulos = todas.filter(a => a.slug !== excluirSlug).slice(0, limite)
  if (articulos.length === 0) return null

  return (
    <section aria-labelledby="mas-leidas-titulo">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="section-accent" />
        <h2 id="mas-leidas-titulo" className="section-label">{titulo}</h2>
      </div>

      <ol className="flex flex-col gap-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {articulos.map((a, i) => {
          const estilo = getSportStyle(a.sport ?? undefined, a.category ?? undefined)
          // `imageUrl` (medio de origen) o, si no, la imagen subida a Sanity.
          let miniatura: string | null = a.imageUrl ?? null
          if (!miniatura && a.image) {
            try { miniatura = urlFor(a.image as Parameters<typeof urlFor>[0]).width(104).height(76).url() } catch { miniatura = null }
          }
          return (
            <li key={a.slug}>
              <Link
                href={`/noticias/${a.slug}`}
                prefetch={false}
                className="flex items-center gap-3 rounded-xl transition-colors hover:bg-white/[0.03]"
                style={{ padding: '9px 10px', textDecoration: 'none', minHeight: 44 }}
              >
                <span
                  aria-hidden
                  className="flex-shrink-0 text-center"
                  style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20,
                    lineHeight: 1, width: 20, color: i === 0 ? estilo.accent : 'var(--text-faint)',
                  }}
                >
                  {i + 1}
                </span>

                {miniatura ? (
                  <span className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 52, height: 38 }}>
                    <DynamicImage
                      src={miniatura}
                      alt=""
                      width={104}
                      height={76}
                      sizes="52px"
                      className="w-full h-full object-cover"
                    />
                  </span>
                ) : (
                  <span
                    className="flex-shrink-0 rounded-lg"
                    // Placeholder con el acento del deporte, no un hueco: con la
                    // opacidad anterior parecía que a la fila le faltaba algo.
                    style={{ width: 52, height: 38, background: `${estilo.accent}26`, border: `1px solid ${estilo.accent}55` }}
                  />
                )}

                <span className="min-w-0 flex flex-col gap-0.5">
                  <span
                    className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: estilo.accent, fontFamily: 'var(--font-sport)' }}
                  >
                    {getSportLabel(a.sport ?? undefined, a.category ?? undefined)}
                  </span>
                  <span
                    className="text-[13px] leading-snug"
                    style={{
                      color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 700,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}
                  >
                    {a.title}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
