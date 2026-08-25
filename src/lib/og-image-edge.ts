// Hermano edge-safe de @/lib/og-image. Mismo objetivo —que un ImageResponse
// nunca devuelva 5xx por culpa de la foto— pero sin sharp, que es un binario
// nativo y no existe en el runtime edge. Las rutas OG de la casa corren en edge
// (19 de 20), así que ahí hay que resolverlo sin transcodificar.
//
// Los dos problemas son los mismos que explica @/lib/og-image:
//
// 1. Satori hace su PROPIO fetch de `<img src>` de forma lazy mientras streamea
//    la respuesta, así que un 404 o un timeout revientan fuera del alcance del
//    try/catch de la ruta → HTTP 500. Un HEAD previo no basta: valida otra
//    petición, no la que satori acabará haciendo. Lo resolvemos igual que en
//    Node: descargamos los bytes nosotros y le pasamos un data: URI, que satori
//    embebe sin volver a salir a la red.
//
// 2. Satori SOLO decodifica JPEG, PNG y GIF. Sin sharp no podemos convertir lo
//    que no entienda, pero sí RECHAZARLO: un WebP o un AVIF devuelven null y la
//    tarjeta se dibuja sin esa imagen. Peor estéticamente que transcodificar,
//    infinitamente mejor que el `TypeError: u2 is not iterable` que devuelve un
//    5xx al crawler. Si una fuente empieza a servir WebP de verdad, esa ruta se
//    baja al runtime nodejs y usa @/lib/og-image.

const FETCH_TIMEOUT_MS = 2500
// Estas rutas embeben logos y escudos, no portadas: con 1MB va sobrado y acota
// lo que satori tiene que parsear en base64.
const MAX_BYTES = 1_000_000
const SATORI_DECODABLE = ['image/jpeg', 'image/png', 'image/gif']

export async function fetchImageDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 TakaSportsOG/1.0' },
    })
    if (!r.ok) return null

    // El content-type manda sobre la extensión: hay fuentes que sirven WebP
    // desde una URL acabada en .png por content-negotiation.
    const ct = (r.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!SATORI_DECODABLE.includes(ct)) return null

    const buf = await r.arrayBuffer()
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null

    // btoa sobre un binario largo peta el stack si se hace con spread. En edge
    // no hay Buffer, así que recorremos el Uint8Array a trozos.
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
    }
    return `data:${ct};base64,${btoa(binary)}`
  } catch {
    return null
  }
}
