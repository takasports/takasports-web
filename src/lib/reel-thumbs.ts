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

/** ¿Es una URL firmada de Instagram ya caducada? Acepta la URL directa o
 *  envuelta en los proxies `/api/instagram/thumbnail?url=…` y
 *  `/api/instagram/video?url=…`. Sirve igual para miniaturas que para vídeos:
 *  los dos llevan el mismo `oe`. */
export function igUrlExpired(u: string | null | undefined): boolean {
  if (!u) return false
  try {
    let ig = u
    const m = u.match(/[?&]url=([^&]+)/)
    if (m) ig = decodeURIComponent(m[1])
    const oe = new URL(ig, 'https://takasportsmedia.com').searchParams.get('oe')
    if (!oe) return false
    const expMs = parseInt(oe, 16) * 1000
    return Number.isFinite(expMs) && expMs < Date.now()
  } catch {
    return false
  }
}

/** Alias histórico: la miniatura es el caso por el que se escribió. */
export const thumbnailExpired = igUrlExpired

/** Código corto del reel (`DdhEhBZAk06`) a partir de su enlace de Instagram. */
export function shortcodeOf(url: string | null | undefined): string | null {
  const m = url?.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{5,40})/i)
  return m ? m[1] : null
}

/**
 * Miniatura de reserva que NO caduca: la URL apunta a nuestro proxy por código
 * corto, y el proxy pide a Instagram una firma nueva en cada fallo de caché
 * (`instagram.com/p/<código>/media/?size=l`, público y sin token).
 */
export function thumbBySc(sc: string): string {
  return `/api/instagram/thumbnail?sc=${encodeURIComponent(sc)}`
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

/**
 * Quita lo caducado sin tirar el reel (lo usa la mezcla de getMergedReels):
 *   · portada caducada o ausente → la de código corto, que no caduca;
 *   · vídeo caducado → fuera (daba 403; la web cae al embed igualmente).
 * Además rellena `shortcode`, para que la API lo sirva siempre.
 */
export function repairExpired<T extends {
  instagram_url: string; shortcode?: string; thumbnail_url: string | null; video_url: string | null
}>(r: T): T & { shortcode?: string } {
  const sc = r.shortcode || shortcodeOf(r.instagram_url) || undefined
  const thumbDead = igUrlExpired(r.thumbnail_url)
  let thumb = r.thumbnail_url
  if (thumbDead || !thumb) thumb = sc ? thumbBySc(sc) : null
  return {
    ...r,
    shortcode: sc,
    thumbnail_url: thumb,
    video_url: igUrlExpired(r.video_url) ? null : r.video_url,
  }
}

/**
 * ¿El reel tiene alguna miniatura que pintar? La URL de Instagram (ya pasada
 * por `stripExpiredThumbs`) o la imagen subida a Sanity. Sin ninguna, la
 * tarjeta sale como un rectángulo casi negro: en la portada no se pinta.
 */
export function reelHasThumbnail(r: {
  thumbnail_url?: string | null
  thumbnail?: { asset?: unknown } | null
}): boolean {
  return Boolean(r.thumbnail_url) || Boolean(r.thumbnail?.asset)
}
