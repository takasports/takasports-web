// Utilidades puras para los bloques de «relacionadas» de la ficha de noticia.
// Sin dependencias (ni Sanity ni env) para poder probarlas con vitest.

interface ConIdentidad {
  _id?: string | null
  slug?: string | null
}

/**
 * Quita de una lista la noticia que se está leyendo. Compara por `_id` y por
 * slug, y trata el borrador (`drafts.<id>`) como la misma pieza: la consulta de
 * Sanity ya la excluye, pero los picks editoriales (`editorialRelated`) los elige
 * una persona y nada impide que apunten a la propia noticia.
 */
export function excludeCurrentArticle<T extends ConIdentidad>(
  list: readonly T[] | null | undefined,
  current: ConIdentidad,
): T[] {
  if (!list) return []
  const baseId = (id?: string | null) => (id ? id.replace(/^drafts\./, '') : null)
  const curId = baseId(current._id)
  const curSlug = current.slug || null
  return list.filter((a) => {
    if (curId && baseId(a._id) === curId) return false
    if (curSlug && a.slug === curSlug) return false
    return true
  })
}
