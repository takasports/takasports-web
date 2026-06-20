import { SITE_URL } from '@/lib/constants'

/**
 * BreadcrumbList JSON-LD reutilizable para los hubs de primer nivel.
 * Varios hubs (predicciones, juegos, estadisticas, calendario, rankings) no
 * emitían breadcrumb structured data, a diferencia del resto del sitio →
 * perdían la migaja en resultados enriquecidos. (Fix M4 SEO)
 *
 * `path` es la ruta relativa (sin dominio); '' = home.
 */
export default function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  }
  return (
    <script
      type="application/ld+json"
      // Objeto controlado server-side: serialización segura.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
