'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DynamicImage from '@/components/DynamicImage'
import { leerGuardadosLocales } from '@/components/SaveArticleButton'

// Lista de noticias guardadas, en el perfil.
//
// Une lo del dispositivo con lo de la cuenta: `user_favorites` guarda cada
// noticia como `noticia:<slug>` y su `meta` trae título e imagen, así que la
// lista se pinta sin volver a Sanity. Lo guardado sin sesión sigue ahí al
// entrar, porque lo local se conserva y se fusiona.
//
// Si no hay nada, no se pinta la sección: el perfil ya tiene bastantes cajas
// vacías compitiendo por la atención.

interface Guardado {
  slug: string
  title?: string
  imageUrl?: string | null
  sport?: string | null
}

export default function GuardadosSection() {
  const [items, setItems] = useState<Guardado[] | null>(null)

  useEffect(() => {
    const locales = leerGuardadosLocales().map(slug => ({ slug }))
    setItems(locales)
    fetch('/api/rankings/favorites', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : { favorites: [] }))
      .then((j: { favorites?: { entry_id: string; meta?: unknown }[] }) => {
        const deNube: Guardado[] = (j.favorites ?? [])
          .filter(f => f.entry_id.startsWith('noticia:'))
          .map(f => {
            const m = (f.meta ?? {}) as Partial<Guardado>
            return {
              slug: f.entry_id.slice('noticia:'.length),
              title: typeof m.title === 'string' ? m.title : undefined,
              imageUrl: typeof m.imageUrl === 'string' ? m.imageUrl : null,
              sport: typeof m.sport === 'string' ? m.sport : null,
            }
          })
        // La nube manda donde hay título; lo local aporta los que aún no subieron.
        const porSlug = new Map<string, Guardado>()
        for (const g of locales) porSlug.set(g.slug, g)
        for (const g of deNube) porSlug.set(g.slug, g)
        setItems([...porSlug.values()])
      })
      .catch(() => { /* nos quedamos con lo local */ })
  }, [])

  if (!items || items.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="section-accent" />
        <h2 className="section-label">Guardados</h2>
        <span className="text-[10px]" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-sport)' }}>
          {items.length}
        </span>
      </div>

      <ul className="flex flex-col gap-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.slice(0, 8).map(g => (
          <li key={g.slug}>
            <Link
              href={`/noticias/${g.slug}`}
              prefetch={false}
              className="flex items-center gap-3 rounded-xl transition-colors hover:bg-white/[0.03]"
              style={{ padding: '9px 10px', textDecoration: 'none', minHeight: 44 }}
            >
              {g.imageUrl ? (
                <span className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 48, height: 36 }}>
                  <DynamicImage src={g.imageUrl} alt="" width={96} height={72} sizes="48px" className="w-full h-full object-cover" />
                </span>
              ) : (
                <span className="flex-shrink-0 rounded-lg" style={{ width: 48, height: 36, background: 'rgba(124,58,237,0.14)', border: '1px solid rgba(124,58,237,0.22)' }} />
              )}
              <span
                className="text-[13px] leading-snug min-w-0"
                style={{
                  color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 700,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}
              >
                {/* Sin título (guardado sin sesión y aún sin subir) el slug ya es legible. */}
                {g.title ?? g.slug.replace(/-/g, ' ')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
