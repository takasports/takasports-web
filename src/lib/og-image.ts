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

// ── Helpers de la placa de historias (1080×1920) ─────────────────

// Nombre legible del medio dueño de la foto, deducido del dominio, para pintar
// el crédito "Foto: X" en la placa. Las portadas vienen de ~130 dominios
// distintos, así que el mapa cubre los frecuentes y el resto cae a la marca del
// dominio (segundo nivel), capitalizada: `imagenes2.mundodeportivo.com` → si no
// estuviera en el mapa, "Mundodeportivo".
const CREDIT_BY_HOST: Array<[RegExp, string]> = [
  [/estaticos-marca|uecdn\.es|marca\.com/, 'Marca'],
  [/mundodeportivo/, 'Mundo Deportivo'],
  [/nyt\.com|nytimes/, 'The New York Times'],
  [/prensaiberica/, 'Prensa Ibérica'],
  [/estadiodeportivo/, 'Estadio Deportivo'],
  [/formula1\.com/, 'Formula 1'],
  [/sportal365/, 'Sportal365'],
  [/ole\.com\.ar/, 'Olé'],
  [/tudn\.com/, 'TUDN'],
  [/sportingnews/, 'Sporting News'],
  [/okdiario/, 'OkDiario'],
  [/clarin/, 'Clarín'],
  [/as\.com|epimg\.net/, 'AS'],
  [/elnacional/, 'El Nacional'],
  [/perfil\.com/, 'Perfil'],
  [/yimg\.com|zenfs/, 'Yahoo'],
  [/autonocion/, 'Autonoción'],
  [/upload\.wikimedia\.org/, 'Wikimedia Commons'],
  [/espncdn/, 'ESPN'],
]

export function mediaCreditFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  let host = ''
  try { host = new URL(url).hostname.toLowerCase() } catch { return null }
  // Las nuestras no llevan crédito de tercero.
  if (/cdn\.sanity\.io|takasportsmedia\.com|supabase\.co|cloudfront\.net/.test(host)) return null
  for (const [re, name] of CREDIT_BY_HOST) if (re.test(host)) return name
  const parts = host.replace(/^www\./, '').split('.')
  const brand = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
  if (!brand) return null
  return brand.charAt(0).toUpperCase() + brand.slice(1)
}

// Escalado del titular por longitud. Bajado un punto respecto al primer montaje:
// al subir el margen lateral de 88 a 120 px (para sobrevivir al recorte de
// Instagram en móviles altos) la caja de texto perdió 64 px de ancho y los
// titulares largos se iban a cinco líneas.
export function storyTitleSize(title: string): number {
  if (title.length > 78) return 74
  if (title.length > 58) return 86
  if (title.length > 40) return 100
  return 116
}

/** Recorta por PALABRA, no por carácter: cortar a pelo dejaba "contr…". */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  // Si la última palabra es larguísima (sin espacios) caemos al corte duro.
  const body = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return body.replace(/[\s,;:.—-]+$/, '') + '…'
}

// La `competition` de Sanity es texto libre y llega sucia: mezcla castellano
// ("Gran Premio de Italia") con inglés de la fuente y coletillas de temporada
// ("Formula 1 2026 Season", "Eurocopa qualifiers"). En una placa de historia eso
// resta más que suma, así que solo se pinta cuando aporta: sin año, sin jerga de
// calendario y sin repetir lo que ya dice la píldora del deporte.
const COMPETITION_NOISE = /\d{4}|season|qualifier|matchweek|matchday|round|regular|playoff/i

export function displayCompetition(
  competition: string | null | undefined,
  sportLabel: string,
): string | null {
  const c = competition?.trim()
  if (!c || c.length > 28) return null
  if (COMPETITION_NOISE.test(c)) return null
  if (c.toLowerCase().includes(sportLabel.toLowerCase())) return null
  return c
}
