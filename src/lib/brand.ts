// Normalización del nombre de MARCA para el display. El pipeline de noticias
// (WF-08) guarda el autor como "Redacción TakaSports" (marca pegada, sin espacio)
// en los ~1.482 artículos de Sanity, pero la marca correcta lleva espacio:
// "Taka Sports". Aquí lo corregimos AL PINTAR (byline + datos SEO del artículo),
// sin tocar el dato en Sanity ni la página de autor /autor/redaccion. Espejo del
// helper homónimo de la app (takasports-app/src/lib/brand.ts).

/**
 * Corrige la marca pegada "TakaSports" → "Taka Sports" en cualquier texto de
 * display. Preciso a propósito: solo toca la forma PascalCase pegada, así que NO
 * altera dominios/URLs en minúscula (takasportsmedia.com) ni un "Taka Sports"
 * que ya venga bien escrito.
 */
export function displayBrand(text: string): string {
  return text.replace(/TakaSports/g, 'Taka Sports')
}

/**
 * Nombre de autor listo para pintar: recorta, normaliza la marca y cae al
 * autor por defecto de la Redacción si viene vacío.
 */
export function displayAuthor(author: string | null | undefined): string {
  const trimmed = author?.trim()
  return trimmed ? displayBrand(trimmed) : 'Redacción Taka Sports'
}
