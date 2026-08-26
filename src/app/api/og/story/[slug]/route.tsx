// GET /api/og/story/[slug] → JPEG 1080×1920 para compartir una noticia en
// historias de Instagram / WhatsApp / Telegram.
//
// Formato vertical 9:16 con la foto a sangre. Los márgenes NO son decorativos,
// salen de cómo pinta Instagram:
//   · Vertical: la fila de perfil tapa los ~250 px de arriba y la barra de
//     responder los ~250 de abajo. Dejamos 300 y 340 para no rozarlos.
//   · Horizontal: el 9:16 se escala para LLENAR la pantalla, y en un móvil de
//     19.5:9 (iPhone moderno) eso recorta ~9% por cada lado. Con los 88 px de
//     antes el titular se cortaba; 120 px (11%) sobrevive con holgura.
// Comprobado montando la placa real bajo la interfaz de Instagram.
//
// SIN CRÉDITO DE FOTO, a propósito (decisión del dueño, 26/08/2026). La placa
// llevó un "Foto: <medio>" al pie durante un día. Si alguna vez hace falta
// devolverlo —una reclamación de un medio o de una agencia, o simplemente
// querer cubrirse: el derecho de paternidad del fotógrafo es irrenunciable en
// España— está entero en el commit `29430c6`, que lo QUITÓ:
//
//   git show 29430c6 -- src/lib/og-image.ts    → el helper mediaCreditFromUrl
//                                                (mapa de ~19 CDNs + fallback
//                                                al dominio) y sus tests
//   git show 29430c6 -- 'src/app/api/og/story/[slug]/route.tsx'
//                                              → las 6 líneas del <span> del pie
//
// Revertirlo son ~25 líneas; no hay que reescribir nada desde cero.

// El enlace NO viaja dentro de la imagen: Meta retiró `contentURL` de la API de
// Sharing to Stories, así que no hay forma soportada de inyectar un link
// clicable. Quien comparte pega la URL en el sticker de enlace de Instagram —
// por eso los clientes copian el enlace al portapapeles al compartir.
//
// Se consume desde:
//   · web  → fetch de la imagen + navigator.share({ files })
//   · app  → expo-file-system + expo-sharing
// Una sola plantilla para ambas: el diseño vive aquí y solo aquí.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { sanityClient } from '@/lib/sanity'
import { accentForSport, getSportLabel } from '@/lib/sports'
import { displayCompetition, fetchImageDataUri, storyTitleSize, truncate } from '@/lib/og-image'

export const runtime     = 'nodejs'
export const contentType = 'image/jpeg'

const W = 1080
const H = 1920

const QUERY = `*[_type == "article" && (_id == $id || slug.current == $id)][0]{
  "title": select(defined(headline) => headline, title),
  "summary": select(defined(headline) => metaDescription, short_summary),
  "competition": select(defined(headline) => competition, category),
  sport,
  imageUrl,
}`

interface Article {
  title?: string
  summary?: string
  competition?: string
  sport?: string
  imageUrl?: string
}

// Las fuentes van EN EL REPO (public/fonts), no se descargan de Google en
// caliente: un fallo de red de terceros no puede tumbar la generación de la
// placa, y así el tipo compuesto es siempre exactamente el mismo. Se leen una
// vez por instancia (promesa a nivel de módulo), no en cada petición.
const fontData = (async () => {
  const dir = path.join(process.cwd(), 'public', 'fonts')
  const [anton, semi, bold] = await Promise.all([
    readFile(path.join(dir, 'Anton-Regular.ttf')),
    readFile(path.join(dir, 'BarlowCondensed-SemiBold.ttf')),
    readFile(path.join(dir, 'BarlowCondensed-Bold.ttf')),
  ])
  return { anton, semi, bold }
})()

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const article = await sanityClient.fetch<Article>(QUERY, { id: slug }).catch(() => null)

  // Sin artículo no hay placa que valga: devolver un lienzo con la marca y nada
  // más sería peor que no dar nada — el cliente se enteraría de que algo falló y
  // podría caer a compartir solo el enlace.
  if (!article?.title) {
    return new Response('article_not_found', { status: 404 })
  }

  const title   = truncate(article.title, 110)
  const summary = article.summary ? truncate(article.summary, 135) : null
  const sport   = getSportLabel(article.sport, article.competition)
  const comp    = displayCompetition(article.competition, sport)
  const accent  = accentForSport(article.sport ?? article.competition)
  const photo   = await fetchImageDataUri(article.imageUrl)
  const { anton, semi, bold } = await fontData

  const titleSize = storyTitleSize(title)

  const png = new ImageResponse(
    (
      <div
        style={{
          width: W, height: H, display: 'flex', flexDirection: 'column',
          background: '#09090F', position: 'relative', fontFamily: 'Barlow Condensed',
        }}
      >
        {/* Foto a sangre — ocupa los dos tercios superiores del lienzo */}
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={W} height={1320}
               style={{ position: 'absolute', top: 0, left: 0, width: W, height: 1320, objectFit: 'cover' }} />
        )}

        {/* Scrim: oscurece arriba (para que se lea la cabecera) y funde a negro
            abajo (para que el titular tenga contraste garantizado sobre cualquier foto) */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: W, height: 1320, display: 'flex',
          background: photo
            ? 'linear-gradient(180deg, rgba(9,9,15,0.72) 0%, rgba(9,9,15,0.05) 26%, rgba(9,9,15,0.55) 66%, #09090F 100%)'
            : `radial-gradient(ellipse 900px 700px at 22% 30%, ${accent}44 0%, transparent 68%)`,
        }} />

        {/* Halo del color del deporte subiendo desde el pie */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', opacity: 0.2,
          background: `radial-gradient(ellipse 900px 700px at 50% 100%, ${accent} 0%, transparent 60%)`,
        }} />

        <div style={{
          position: 'relative', display: 'flex', flexDirection: 'column',
          width: W, height: H, padding: '300px 120px 340px',
        }}>
          {/* Sin cabecera de marca arriba: Instagram ya pinta @takasports en esa
              misma franja, así que repetirlo solo tapaba foto. La firma va toda
              en el pie, que además es lo último que se lee. */}
          <div style={{ display: 'flex', flex: 1 }} />

          {/* Bloque editorial */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 38 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {sport && (
                <div style={{
                  display: 'flex', padding: '12px 30px 9px', borderRadius: 9999, background: accent,
                  color: '#09090F', fontSize: 30, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                }}>
                  {sport}
                </div>
              )}
              {comp && (
                <span style={{
                  fontSize: 28, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  {comp}
                </span>
              )}
            </div>

            <div style={{
              fontFamily: 'Anton', fontSize: titleSize, lineHeight: 0.96,
              textTransform: 'uppercase', color: '#fff', letterSpacing: '-0.01em',
            }}>
              {title}
            </div>

            {summary && (
              <div style={{
                display: 'flex', fontSize: 34, lineHeight: 1.34, color: 'rgba(255,255,255,0.6)',
                fontWeight: 500, borderLeft: `8px solid ${accent}`, paddingLeft: 26,
              }}>
                {summary}
              </div>
            )}

            {/* Pie: la llamada a la web */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 20, paddingTop: 30, borderTop: '2px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{
                  fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.38)',
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                }}>
                  Lee la noticia completa
                </span>
                <span style={{ fontFamily: 'Anton', fontSize: 40, color: accent }}>
                  TAKASPORTSMEDIA.COM
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: 'Anton',            data: anton, weight: 400, style: 'normal' },
        { name: 'Barlow Condensed', data: semi,  weight: 500, style: 'normal' },
        { name: 'Barlow Condensed', data: semi,  weight: 600, style: 'normal' },
        { name: 'Barlow Condensed', data: bold,  weight: 700, style: 'normal' },
      ],
    },
  )

  // satori solo sabe escupir PNG, y un PNG de 1080×1920 con una foto dentro pesa
  // ~2 MB. Recomprimido a JPEG baja a ~300 KB (medido: −80%). Importa porque el
  // móvil descarga la placa ENTERA antes de que se abra la hoja de compartir:
  // con datos móviles esos 1,7 MB de más son segundos mirando "Creando la
  // imagen…". Al ser una fotografía, la pérdida no se aprecia.
  const cacheHeaders = {
    // Un artículo publicado no cambia de titular ni de foto → 24 h de CDN, y un
    // mes sirviendo la copia vieja mientras se revalida por detrás.
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=2592000',
    'CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=2592000',
  }

  try {
    const jpeg = await sharp(Buffer.from(await png.arrayBuffer()))
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer()
    return new Response(new Uint8Array(jpeg), {
      headers: { ...cacheHeaders, 'Content-Type': 'image/jpeg' },
    })
  } catch {
    // Si sharp falla, mejor el PNG pesado que ninguna placa.
    return new Response(png.body, {
      headers: { ...cacheHeaders, 'Content-Type': 'image/png' },
    })
  }
}
