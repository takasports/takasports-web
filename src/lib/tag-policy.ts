// Qué páginas de etiqueta merecen estar en Google.
//
// Vive aparte de `sanity.ts` porque ese módulo monta el cliente de Sanity con
// variables de entorno al importarlo, y esto debe poder probarse sin ellas.
// `sanity.ts` lo reexporta para no romper a quien ya lo importaba de allí.
//
// El porqué del umbral, medido en Search Console a 90 días (31/08/2026):
//   · 609 páginas de etiqueta tuvieron impresiones y trajeron SEIS clics en
//     total (CTR 0,16%). Ninguna repitió: seis clics de seis etiquetas
//     distintas, uno cada una. No hay ninguna que funcione y haya que salvar.
//   · Las que más impresiones se comían eran NOMBRES DE JUGADOR —"karim
//     adeyemi" 324, "thiago almada" 211, "morten hjulmand" 89— compitiendo por
//     la misma consulta que la ficha del jugador, que sí tiene datos y sí es la
//     respuesta. La etiqueta le quitaba el sitio a la ficha.
//
// Con el umbral en 3 se indexaban 1.976 etiquetas, el 28% del sitemap. Con 10
// quedan ~505: los temas que de verdad se repiten. Medido también: >=5 dejaría
// 1.093 y >=20 solo 240; el 10 es donde la etiqueta deja de ser una frase
// suelta y pasa a ser un archivo.
//
// Lo que NO pasa: las etiquetas no desaparecen del sitio. Siguen navegables y
// en `noindex,follow`, así que conservan el paso de enlaces. Solo dejan de
// competir por rastreo con las páginas que sí responden.

/** Mínimo de artículos publicados para que una etiqueta sea indexable. */
export const MIN_TAG_ARTICLES = 10

/**
 * Etiquetas que no se indexan pase lo que pase: slug numérico puro o de menos
 * de tres caracteres (`/tag/2`, `/tag/a`).
 */
export function isJunkTag(tag: string): boolean {
  const t = tag.trim()
  if (t.length < 3) return true
  if (/^\d+$/.test(t)) return true
  return false
}

/** Normaliza para comparar una etiqueta con el nombre de una ficha. */
export function normalizarTag(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

/**
 * ¿Esta etiqueta entra al sitemap y se indexa?
 *
 * `duplicaFicha` manda por encima del recuento: si la etiqueta ES el nombre de
 * un jugador que ya tiene ficha, no se indexa por muchos artículos que tenga.
 * La ficha responde mejor esa búsqueda —tiene datos, foto y no caduca— y dos
 * páginas nuestras compitiendo por la misma consulta se estorban.
 *
 * Ese caso no es teórico: "karim adeyemi" tiene exactamente 10 artículos, así
 * que pasaba el umbral, y se comía 324 impresiones sin un solo clic.
 */
export function esTagIndexable(tag: string, articulos: number, duplicaFicha = false): boolean {
  if (isJunkTag(tag)) return false
  if (duplicaFicha) return false
  return articulos >= MIN_TAG_ARTICLES
}
