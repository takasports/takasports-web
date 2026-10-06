import { NextRequest, NextResponse } from 'next/server'

// GET /api/geo → { country: 'US' | null }
//
// País del visitante según la cabecera que añade Vercel (`x-vercel-ip-country`).
// Solo lo consulta el selector de idioma de los reportajes con más de una
// versión, y solo cuando el navegador no da ya una pista (ver IdiomaSelector).
// Al ir por API y no por middleware no cuesta ninguna invocación de Edge Middleware
// en las páginas de contenido, que siguen siendo ISR cacheadas.
//
// Nunca se cachea en el CDN: la respuesta depende de quién pregunta.
export const runtime = 'edge'

export function GET(req: NextRequest) {
  const country = req.headers.get('x-vercel-ip-country')
  return NextResponse.json(
    { country: country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
