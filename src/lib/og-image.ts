import sharp from 'sharp'

// Descarga la portada de un artículo y la devuelve como data URI listo para
// `<img src>` dentro de un ImageResponse (satori). Dos problemas que resuelve:
//
// 1. NO basta con validar la URL y pasarla a <img src>: satori hace su propio
//    fetch de forma lazy MIENTRAS streamea la respuesta, así que si ese fetch
//    falla (404, timeout, GET≠HEAD) el error escapa de cualquier try/catch de la
//    ruta y devuelve HTTP 500 ("Error de servidor 5xx" en Search Console).
//    Fetcheando los bytes nosotros y pasando un data: URI, satori los embebe sin
//    volver a salir a la red → imposible que crashee por ahí.
//
// 2. Satori SOLO decodifica JPEG, PNG y GIF. Con WebP o AVIF no falla limpio:
//    revienta con `TypeError: u2 is not iterable` dentro del stream, otra vez
//    fuera del alcance del try/catch. Y el 14% de las portadas del feed son
//    .webp (fuentes tipo media.formula1.com), más las que lo sirven por
//    content-negotiation sin decirlo en la URL. Por eso transcodificamos SIEMPRE
//    a JPEG con sharp: cualquier formato que entienda sharp entra, y lo que sale
//    es siempre un formato que satori sabe leer.
//
// Si algo falla en cualquier paso devolvemos null → el OG se renderiza sin foto
// (fallback con branding + gradiente), que siempre da 200.

const FETCH_TIMEOUT_MS = 3500
// Cap sobre los bytes de ORIGEN. El render de satori ya no depende de este
// tamaño (sale un JPEG de 1080px pase lo que pase), solo acota la memoria y el
// tiempo de descarga de la función.
const MAX_SOURCE_BYTES = 8_000_000
// El hueco de la foto en la tarjeta OG es ~660×630 px. 1080 de ancho da margen
// de sobra y recorta el peso del base64, que es lo que satori tiene que parsear.
const TARGET_WIDTH = 1080
const JPEG_QUALITY = 80
// JPEG no tiene canal alfa: un PNG transparente saldría con fondo negro duro.
// Lo aplanamos contra el fondo de la tarjeta para que el corte no cante.
const FLATTEN_BG = '#09090F'

export async function fetchImageDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 TakaSportsOG/1.0' },
    })
    if (!r.ok) return null
    const ct = r.headers.get('content-type') ?? ''
    if (!ct.startsWith('image/')) return null

    const source = Buffer.from(await r.arrayBuffer())
    if (source.byteLength === 0 || source.byteLength > MAX_SOURCE_BYTES) return null

    const jpeg = await sharp(source, { animated: false })
      .rotate() // aplica la orientación EXIF, que satori ignoraría
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .flatten({ background: FLATTEN_BG })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer()

    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    return null
  }
}
