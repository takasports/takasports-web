// Índice slug → etiqueta de todo el archivo, cacheado.
//
// Lo usan la página de etiqueta (para saber qué grafías buscar a partir del slug
// de la URL), el índice /tag y el sitemap. Leer todas las etiquetas en cada
// visita era una consulta a Sanity por página vista; así es una por hora, y el
// webhook de Sanity lo refresca al publicar (tag `tag-index`).

import { unstable_cache } from 'next/cache'
import { sanityClient, allTagsFlatQuery } from './sanity'
import { agruparTags, type GrupoTag } from './tag-slug'

export const TAG_INDEX_CACHE_TAG = 'tag-index'

/** Lanza si Sanity falla: un error no se queda en la caché. */
export const getTagIndex = unstable_cache(
  async (): Promise<Record<string, GrupoTag>> => {
    const planas = await sanityClient.fetch<unknown[]>(allTagsFlatQuery)
    return Object.fromEntries(agruparTags(planas))
  },
  ['tag-index-v1'],
  { revalidate: 3600, tags: [TAG_INDEX_CACHE_TAG] },
)
