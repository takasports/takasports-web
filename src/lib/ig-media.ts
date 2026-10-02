// Descarga de imágenes del CDN de Instagram, server-side. La usan el proxy de
// miniaturas y la sincronización de reels (que copia cada miniatura a Storage).

const ALLOWED_HOSTS = ['cdninstagram.com', 'fbcdn.net']

/** Solo dominios del CDN de Instagram/Meta, por SUFIJO EXACTO (no `includes`,
 *  que dejaba pasar `scontent.evil.com`). Sin IPs: cierra el SSRF. */
export function igHostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return ALLOWED_HOSTS.some((base) => h === base || h.endsWith('.' + base))
}

const IG_IMG_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://www.instagram.com/',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
}

export interface IgImage {
  body: ArrayBuffer
  contentType: string
}

/** Baja una imagen de una URL firmada del CDN. null si no es del CDN, no es una
 *  imagen o Instagram la rechaza (firma caducada, límite por IP…). */
export async function fetchIgImage(url: string, timeoutMs = 8000): Promise<IgImage | null> {
  let parsed: URL
  try { parsed = new URL(url) } catch { return null }
  if (parsed.protocol !== 'https:' || !igHostAllowed(parsed.hostname)) return null
  try {
    const res = await fetch(parsed.toString(), { headers: IG_IMG_HEADERS, signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    return { body: await res.arrayBuffer(), contentType }
  } catch {
    return null
  }
}

export const SC_RE = /^[A-Za-z0-9_-]{5,40}$/

/**
 * Miniatura de un reel por su código corto, SIN token: la página pública
 * `instagram.com/p/<código>/media/?size=l` redirige (302) a la portada con una
 * firma recién hecha. Comprobado el 02/10/2026 con curl contra reels de
 * @taka.sports: 302 → imagen JPEG 1080 px. (`/reel/<código>/media/` da 404; tiene
 * que ser `/p/`.)
 *
 * Ojo: Instagram puede tratar distinto a las IPs de centros de datos. Por eso
 * esto es la RESERVA; lo normal es que la miniatura ya esté copiada en Storage.
 */
export async function fetchThumbByShortcode(sc: string, timeoutMs = 8000): Promise<IgImage | null> {
  if (!SC_RE.test(sc)) return null
  try {
    const res = await fetch(`https://www.instagram.com/p/${sc}/media/?size=l`, {
      headers: { 'User-Agent': IG_IMG_HEADERS['User-Agent'] },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
    const loc = res.headers.get('location')
    if (res.status < 300 || res.status >= 400 || !loc) return null
    return fetchIgImage(new URL(loc, 'https://www.instagram.com').toString(), timeoutMs)
  } catch {
    return null
  }
}
