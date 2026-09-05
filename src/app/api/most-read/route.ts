import { NextResponse } from 'next/server'
import { getMostRead } from '@/lib/most-read'
import { urlFor } from '@/lib/sanity'

// "Lo más leído de la semana", en JSON, para la app.
//
// La web no necesita este endpoint: `MasLeidas` es un componente de servidor y
// llama a `getMostRead()` directamente. La app es un cliente delgado de esta API
// y no puede hacerlo, porque el módulo habla con Search Console con una
// credencial que solo existe en el servidor.
//
// La imagen se resuelve AQUÍ. Los artículos del pipeline traen la foto del medio
// de origen en `imageUrl`, pero los que llevan foto propia la traen como objeto
// de Sanity, que hay que convertir en URL con el constructor del CDN. Dejar esa
// conversión al cliente obligaría a la app a conocer el proyecto de Sanity y a
// repetir la lógica; peor, ya pasó una vez que un tipo local de la app se comió
// campos de la respuesta sin que nadie se enterara.
//
// Cachea el propio `getMostRead` (6 h). Aquí solo se declara la caché de la
// respuesta para que el CDN no pregunte en cada arranque de la app.

export const revalidate = 21600

export interface MasLeidaApi {
  slug: string
  title: string
  /** Ya resuelta: del medio de origen o del CDN de Sanity. `null` si no hay. */
  imageUrl: string | null
  sport: string | null
  category: string | null
  /** Clics desde Google en la ventana medida. Sirve para ordenar, no para pintar. */
  clicks: number
}

/** El ancho del hueco en la app; el CDN de Sanity redimensiona gratis. */
const ANCHO = 400

export async function GET(request: Request) {
  const pedido = Number(new URL(request.url).searchParams.get('limite'))
  const limite = Number.isFinite(pedido) ? Math.min(Math.max(pedido, 1), 20) : 5

  const articulos = await getMostRead(limite)

  const salida: MasLeidaApi[] = articulos.map(a => {
    let imageUrl = a.imageUrl ?? null
    if (!imageUrl && a.image) {
      // urlFor revienta si el objeto no es una imagen válida de Sanity; un
      // artículo con la foto mal puesta no debe tumbar el bloque entero.
      try {
        imageUrl = urlFor(a.image as Parameters<typeof urlFor>[0]).width(ANCHO).url()
      } catch {
        imageUrl = null
      }
    }
    return {
      slug: a.slug,
      title: a.title,
      imageUrl,
      sport: a.sport ?? null,
      category: a.category ?? null,
      clicks: a.clicks,
    }
  })

  // Lista vacía es una respuesta legítima: si Search Console falla, el bloque
  // simplemente no se pinta, igual que en la web. Nunca un error para el cliente.
  return NextResponse.json(
    { articulos: salida },
    { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
  )
}
