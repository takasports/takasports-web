'use client'

import { useEffect } from 'react'
import { trackSiteSearch } from '@/lib/analytics'

// La página /buscar es un Server Component, así que el evento de analítica tiene
// que dispararse desde un componente cliente. No renderiza nada: solo reporta a
// GA4 qué se buscó y cuántos resultados hubo.
//
// Por qué importa: /buscar es noindex y está en disallow, así que esta intención
// de búsqueda no aparece NUNCA en Search Console. Sin este evento no había forma
// de saber qué busca la gente en el sitio — y en particular qué busca sin
// encontrarlo, que es justo lo que conviene publicar.
export default function SearchTracker({
  query,
  resultCount,
  sport,
}: {
  query: string
  resultCount: number
  sport?: string
}) {
  useEffect(() => {
    if (query.length < 2) return
    trackSiteSearch({ query, resultCount, sport })
    // Se reporta por combinación término+filtro: cambiar la faceta es otra búsqueda.
  }, [query, resultCount, sport])

  return null
}
