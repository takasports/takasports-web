import { getMostRead } from '@/lib/most-read'
import ArticleCard, { type ArticleCardData } from '@/components/news/ArticleCard'

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
        {articulos.map((a, i) => (
          <li key={a.slug}>
            {/* Search Console no devuelve `_id` ni fecha: la tarjeta ya lo
                contempla (el sello de fecha simplemente no se pinta). */}
            <ArticleCard
              article={{
                slug: a.slug,
                title: a.title,
                imageUrl: a.imageUrl ?? null,
                image: (a.image ?? null) as ArticleCardData['image'],
                sport: a.sport ?? undefined,
                category: a.category ?? undefined,
              }}
              variant="row"
              size="sm"
              rank={i + 1}
              kicker
              prefetch={false}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}
