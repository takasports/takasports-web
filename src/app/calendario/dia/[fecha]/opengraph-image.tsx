// Tarjeta de compartir de un día del calendario (1200×630).
//
// Es lo que se ve cuando alguien manda /calendario/dia/<fecha> por WhatsApp, X o
// Telegram: «Partidos del jueves 22 de octubre», los tres partidos estrella con
// escudo, hora, competición y canal, y «Hora de España». Hasta ahora la página
// enseñaba el logo de la casa, que no dice nada de qué se juega.
//
// · Las estrellas salen del MISMO ranking que la descripción de Google
//   (dayStars → pickDayStars). Aquí sin listón: un día sin cartel grande también
//   pinta sus tres filas, en el mismo orden.
// · Escudos: los descargamos nosotros y van como data URI, a tamaño pequeño por
//   el combiner gratuito de ESPN (ver lib/espn-image). Satori solo entiende
//   PNG/JPEG/GIF y revienta con WebP FUERA del try/catch (5xx al crawler):
//   fetchImageDataUri rechaza lo que no sabe leer y la fila cae a las iniciales.
// · Runtime Node: necesita la misma carga del día que la página (Supabase,
//   Sanity, ESPN) y las fuentes del repo.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { fetchImageDataUri } from '@/lib/og-image-edge'
import { imagenPequenaGratis } from '@/lib/espn-image'
import { accentForSport } from '@/lib/sports'
import { shortCompName } from '@/lib/calendar-competitions'
import { dayShareHeadline, isPastDay, isValidDayParam, type DayStar } from '@/lib/calendar-day-page'
import { dayStars, loadDay, todayIso } from '@/lib/calendar-day-data'
import { truncate } from '@/lib/og-image'

export const alt = 'Partidos del día en TakaSports'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
// Una hora: los horarios de un día no cambian cada cinco minutos, y quien
// comparte de madrugada no necesita el último cambio de canal.
export const revalidate = 3600

const BG = '#09090F'
const BRAND = '#A78BFA'

// Fuentes del repo, leídas una vez por instancia (mismo criterio que la placa de
// historias): un fallo de red de Google Fonts no puede tumbar la tarjeta.
const fontData = (async () => {
  const dir = path.join(process.cwd(), 'public', 'fonts')
  try {
    const [anton, semi, bold] = await Promise.all([
      readFile(path.join(dir, 'Anton-Regular.ttf')),
      readFile(path.join(dir, 'BarlowCondensed-SemiBold.ttf')),
      readFile(path.join(dir, 'BarlowCondensed-Bold.ttf')),
    ])
    return { anton, semi, bold }
  } catch {
    return null
  }
})()

/**
 * Variante para fondo oscuro de un escudo de ESPN (`/500/` → `/500-dark/`). El
 * escudo «normal» de la Juventus, del Newcastle o de la selección alemana es
 * negro, y sobre el fondo de la tarjeta desaparece. No todos los equipos la
 * tienen (404), así que siempre hay vuelta a la normal.
 */
function espnDarkVariant(url: string | undefined): string | undefined {
  if (!url || !url.includes('a.espncdn.com') || !/\/i\/teamlogos\/[^/]+\/500\//.test(url)) return undefined
  return url.replace(/(\/i\/teamlogos\/[^/]+)\/500\//, '$1/500-dark/')
}

async function crestDataUri(url: string | undefined): Promise<string | null> {
  const dark = espnDarkVariant(url)
  if (dark) {
    const d = await fetchImageDataUri(imagenPequenaGratis(dark, CREST))
    if (d) return d
  }
  return fetchImageDataUri(imagenPequenaGratis(url, CREST))
}

const CREST = 52

interface Row extends DayStar {
  accent: string
  homeImg: string | null
  awayImg: string | null
}

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Crest({ src, name, accent }: { src: string | null; name: string; accent: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} width={CREST} height={CREST} style={{ objectFit: 'contain' }} alt="" />
  }
  // Respaldo cuando el escudo no llega o es WebP: iniciales en un disco con el
  // color del deporte. Mejor que un hueco, y la fila sigue leyéndose.
  return (
    <div
      style={{
        width: CREST, height: CREST, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${accent}22`, border: `2px solid ${accent}55`, color: '#E8E8F4',
        fontSize: 19, fontWeight: 700, letterSpacing: '0.02em',
      }}
    >
      {initials(name)}
    </div>
  )
}

export default async function Image({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params
  const fonts = await fontData
  const t = todayIso()
  const valid = isValidDayParam(fecha)

  // Sin datos (fecha rara, Supabase caído) se pinta la cabecera sola: una
  // tarjeta sin filas es mejor que un 5xx al compartir.
  const events = valid ? await loadDay(fecha).catch(() => []) : []
  // Elegidos por importancia (el mismo ranking que Google), pintados por HORA:
  // en una tarjeta se lee el día de arriba abajo, y por rango el reloj saltaba
  // (18:45, 21:00, 18:45).
  const stars = dayStars(events, 3, -Infinity)
    .map(s => ({ s, ev: events.find(e => e.home.trim() === s.home && (e.away ?? '').trim() === s.away) }))
    .sort((a, b) => (a.ev?.isoDate ?? '').localeCompare(b.ev?.isoDate ?? ''))
  const rows: Row[] = await Promise.all(
    stars.map(async ({ s, ev }) => {
      const [homeImg, awayImg] = await Promise.all([crestDataUri(s.homeLogo), crestDataUri(s.awayLogo)])
      return {
        ...s,
        comp: s.comp ? shortCompName(s.comp, ev?.sport) : undefined,
        accent: accentForSport(ev?.sport, BRAND),
        homeImg,
        awayImg,
      }
    }),
  )

  const headline = valid ? dayShareHeadline(fecha, t) : 'Partidos del día'
  // Con marcadores la hora ya no se pinta: «Hora de España» sobraría.
  const pasado = valid && isPastDay(fecha, t)
  const count = events.length
  const headSize = headline.length > 36 ? 58 : headline.length > 30 ? 64 : 70
  const family = fonts ? 'Barlow Condensed' : undefined

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: BG, position: 'relative', overflow: 'hidden', fontFamily: family,
          padding: '44px 56px 36px',
        }}
      >
        {/* Brillo de marca arriba a la izquierda */}
        <div style={{
          position: 'absolute', top: -220, left: -160, width: 760, height: 520, borderRadius: 9999,
          background: 'radial-gradient(circle, rgba(124,58,237,0.30) 0%, transparent 65%)', display: 'flex',
        }} />

        {/* Marca + recuento */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontFamily: fonts ? 'Anton' : undefined, fontSize: 30, color: '#F0F0FF', letterSpacing: '0.01em' }}>
              TAKASPORTS
            </span>
            <div style={{ width: 6, height: 6, borderRadius: 999, background: BRAND, display: 'flex' }} />
            <span style={{ fontSize: 22, fontWeight: 700, color: BRAND, letterSpacing: '0.16em' }}>CALENDARIO</span>
          </div>
          {count > 0 && (
            <div style={{
              display: 'flex', padding: '6px 16px', borderRadius: 999, fontSize: 22, fontWeight: 700,
              color: '#C4B5FD', background: 'rgba(124,58,237,0.14)', border: '1.5px solid rgba(124,58,237,0.35)',
              letterSpacing: '0.06em',
            }}>
              {count} {count === 1 ? 'PARTIDO' : 'PARTIDOS'}
            </div>
          )}
        </div>

        {/* Titular con la fecha (nunca «hoy»: la tarjeta se ve días después) */}
        <div style={{
          display: 'flex', marginTop: 18, fontFamily: fonts ? 'Anton' : undefined, fontSize: headSize,
          color: '#F5F5FF', lineHeight: 1.04, letterSpacing: '0.005em', textTransform: 'uppercase',
        }}>
          {headline}
        </div>

        {/* Los tres partidos estrella */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24, flex: 1 }}>
          {rows.length === 0 ? (
            <div style={{
              display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20,
              border: '1.5px dashed rgba(255,255,255,0.12)', color: '#8888A8', fontSize: 30, fontWeight: 600,
            }}>
              {count > 0 ? 'Todos los horarios y dónde verlos' : 'Agenda deportiva del día'}
            </div>
          ) : rows.map((r, i) => {
            const meta = [r.comp, r.channel].filter(Boolean).join(' · ')
            // Cabe «Los Angeles Lakers – Golden State Warriors» bajando un poco
            // el cuerpo en vez de cortar el nombre del rival.
            const names = `${r.home} – ${r.away}${r.femenino ? ' (F)' : ''}`
            const clock = r.score ?? r.time ?? '—'
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 20, height: 104, padding: '0 26px 0 0',
                  borderRadius: 18, background: 'rgba(255,255,255,0.045)', border: '1.5px solid rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: 6, alignSelf: 'stretch', background: r.accent, display: 'flex' }} />
                <div style={{
                  display: 'flex', width: 132, justifyContent: 'center', fontFamily: fonts ? 'Anton' : undefined,
                  fontSize: r.score ? 40 : 44, color: r.accent, letterSpacing: '0.01em',
                }}>
                  {clock}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Crest src={r.homeImg} name={r.home} accent={r.accent} />
                  <Crest src={r.awayImg} name={r.away} accent={r.accent} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 2, marginLeft: 6 }}>
                  <div style={{ display: 'flex', fontSize: names.length > 34 ? 31 : 36, fontWeight: 700, color: '#F0F0FA', lineHeight: 1.1 }}>
                    {truncate(names, 44)}
                  </div>
                  {meta && (
                    <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, color: '#9A9AB4', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {truncate(meta, 56)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Pie: zona horaria (la hora es la de España) y dirección */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
          {pasado ? <div style={{ display: 'flex' }} /> : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#8888A8', fontSize: 22, fontWeight: 600, letterSpacing: '0.08em' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#8888A8" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="#8888A8" strokeWidth="2" strokeLinecap="round" />
            </svg>
            HORA DE ESPAÑA
          </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 2, background: BRAND, display: 'flex' }} />
            <span style={{ fontSize: 22, fontWeight: 700, color: BRAND, letterSpacing: '0.08em' }}>TAKASPORTSMEDIA.COM</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      // Que la sirva el CDN: sin esto sale `max-age=0, must-revalidate` y cada
      // vista previa de WhatsApp/X/Telegram volvería a cargar el día entero y a
      // bajar seis escudos. Una hora fresca y un día de margen mientras se rehace.
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' },
      ...(fonts
        ? {
            fonts: [
              { name: 'Anton', data: fonts.anton, weight: 400 as const, style: 'normal' as const },
              { name: 'Barlow Condensed', data: fonts.semi, weight: 600 as const, style: 'normal' as const },
              { name: 'Barlow Condensed', data: fonts.bold, weight: 700 as const, style: 'normal' as const },
            ],
          }
        : {}),
    },
  )
}
