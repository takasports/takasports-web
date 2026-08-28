// Caducidad de las miniaturas de Instagram.
//
// Las URLs del CDN de Instagram van firmadas y llevan `oe` (expiración, unix en
// hex). Pasada esa fecha el CDN devuelve 403 y la tarjeta se queda en blanco. El
// 28/08/2026 `/noticias` pedía 11 miniaturas y 6 daban 403 — una había caducado
// el 15 de mayo, tres meses y medio antes.
//
// Vive aparte de reels-feed.ts a propósito: ahí dentro hay un cliente de Sanity
// que exige variables de entorno al importarse, y esto tiene que poder probarse
// (y usarse) sin arrastrar nada.

/** ¿La miniatura es una URL de Instagram ya caducada? Acepta la URL directa o
 *  envuelta en el proxy `/api/instagram/thumbnail?url=…`. */
export function thumbnailExpired(thumb: string | null | undefined): boolean {
  if (!thumb) return false
  try {
    let ig = thumb
    const m = thumb.match(/[?&]url=([^&]+)/)
    if (m) ig = decodeURIComponent(m[1])
    const oe = new URL(ig, 'https://takasportsmedia.com').searchParams.get('oe')
    if (!oe) return false
    const expMs = parseInt(oe, 16) * 1000
    return Number.isFinite(expMs) && expMs < Date.now()
  } catch {
    return false
  }
}

/**
 * Deja los reels sin su `thumbnail_url` cuando esa URL ya caducó.
 *
 * `getMergedReels` descarta esos reels enteros, pero la HOME, `/[sport]` y
 * `/noticias` leen los reels DIRECTAMENTE de Sanity y se saltaban el filtro.
 *
 * Aquí no se tira el reel: se le quita la URL muerta para que la tarjeta caiga
 * en la miniatura de Sanity si la tiene, y si no, en su degradado. Perder el
 * reel entero sería peor que perder su foto.
 */
export function stripExpiredThumbs<T extends { thumbnail_url?: string | null }>(
  reels: readonly T[],
): T[] {
  return reels.map((r) => (thumbnailExpired(r.thumbnail_url) ? { ...r, thumbnail_url: undefined } : r))
}
