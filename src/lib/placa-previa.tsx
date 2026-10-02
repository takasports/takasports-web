// Placa de portada de una previa (1200×675). El dibujo vive aquí y lo usa
// /api/og/previa/[ref]; separarlo permite renderizarla con datos de prueba.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { fetchImageDataUri, truncate } from '@/lib/og-image'

const W = 1200
const H = 675

const fontData = (async () => {
  const dir = path.join(process.cwd(), 'public', 'fonts')
  const [anton, semi, bold] = await Promise.all([
    readFile(path.join(dir, 'Anton-Regular.ttf')),
    readFile(path.join(dir, 'BarlowCondensed-SemiBold.ttf')),
    readFile(path.join(dir, 'BarlowCondensed-Bold.ttf')),
  ])
  return { anton, semi, bold }
})()

export interface DatosEncargo {
  home?: string
  away?: string
  competicion?: string
  kickoffIso?: string
  estadio?: string | null
  ciudad?: string | null
  sport?: string
}

// Escudo con su transparencia: `fetchImageDataUri` pasa todo a JPEG (aplana el alfa
// sobre blanco), que para una foto está bien pero deja un cuadrado blanco detrás de
// cada escudo.
export async function escudoPng(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const png = await sharp(Buffer.from(await r.arrayBuffer()))
      .resize(260, 260, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

const hora = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(iso)).toUpperCase()

const hex = (c: unknown, fallback: string) => (typeof c === 'string' && /^[0-9a-f]{6}$/i.test(c) ? `#${c}` : fallback)

export interface PlacaPrevia {
  home: string
  away: string
  competicion: string
  kickoffIso?: string | null
  estadio?: string | null
  ciudad?: string | null
  accent: string
  colorHome: string
  colorAway: string
  logoHome?: string | null
  logoAway?: string | null
  fotoUrl?: string | null
}

/** Devuelve la placa como JPEG (PNG si sharp falla). */
export async function renderPlacaPrevia(p: PlacaPrevia): Promise<{ body: Uint8Array | ReadableStream<Uint8Array> | null; type: string }> {
  const { home, away, competicion, accent, colorHome, colorAway } = p
  const kickoff = p.kickoffIso ?? null
  const estadio = p.estadio ?? null
  const ciudad = p.ciudad ?? null
  const [escHome, escAway, foto, { anton, semi, bold }] = await Promise.all([
    escudoPng(p.logoHome),
    escudoPng(p.logoAway),
    p.fotoUrl ? fetchImageDataUri(p.fotoUrl) : Promise.resolve(null),
    fontData,
  ])

  const tamNombre = Math.max(home.length, away.length) > 14 ? 40 : 52

  const equipo = (nombre: string, escudo: string | null) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 330, gap: 18 }}>
      <div style={{ display: 'flex', width: 210, height: 210, alignItems: 'center', justifyContent: 'center' }}>
        {escudo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={escudo} alt="" width={210} height={210} style={{ objectFit: 'contain' }} />
          : <div style={{ display: 'flex', fontFamily: 'Anton', fontSize: 96, color: '#fff' }}>{nombre.slice(0, 1)}</div>}
      </div>
      <div style={{
        display: 'flex', fontFamily: 'Anton', fontSize: tamNombre, color: '#fff', textTransform: 'uppercase',
        textAlign: 'center', lineHeight: 1, justifyContent: 'center',
      }}>
        {truncate(nombre, 22)}
      </div>
    </div>
  )

  const png = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: '#09090F', fontFamily: 'Barlow Condensed' }}>
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} />
        )}
        {/* Sobre foto: velo oscuro para que escudos y hora se lean sobre cualquier imagen.
            Sin foto: un halo del color de cada equipo desde su lado. */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex',
          background: foto
            ? 'linear-gradient(180deg, rgba(9,9,15,0.80) 0%, rgba(9,9,15,0.70) 45%, rgba(9,9,15,0.90) 100%)'
            : `radial-gradient(ellipse 620px 520px at 12% 55%, ${colorHome}66 0%, transparent 70%), radial-gradient(ellipse 620px 520px at 88% 55%, ${colorAway}66 0%, transparent 70%)`,
        }} />

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: W, height: H, padding: '44px 56px 38px' }}>
          {/* Cabecera: PREVIA + competición */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              display: 'flex', padding: '8px 22px 5px', borderRadius: 9999, background: accent, color: '#09090F',
              fontSize: 26, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
            }}>
              Previa
            </div>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {truncate(competicion, 48)}
            </div>
          </div>

          {/* Enfrentamiento */}
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
            {equipo(home, escHome)}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 440, gap: 6 }}>
              {kickoff ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em' }}>
                    {fecha(kickoff)}
                  </div>
                  <div style={{ display: 'flex', fontFamily: 'Anton', fontSize: 104, color: '#fff', lineHeight: 1 }}>
                    {hora(kickoff, 'Europe/Madrid')}
                  </div>
                  <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: accent, letterSpacing: '0.2em' }}>
                    HORA DE ESPAÑA
                  </div>
                  <div style={{ display: 'flex', marginTop: 12, fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.78)', letterSpacing: '0.04em' }}>
                    {`MÉX ${hora(kickoff, 'America/Mexico_City')} · COL ${hora(kickoff, 'America/Bogota')} · ARG ${hora(kickoff, 'America/Argentina/Buenos_Aires')}`}
                  </div>
                </div>
              ) : null}
            </div>
            {equipo(away, escAway)}
          </div>

          {/* Pie: estadio y marca */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 18, borderTop: '2px solid rgba(255,255,255,0.12)',
          }}>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {estadio ? truncate(`${estadio}${ciudad ? ` · ${ciudad}` : ''}`, 56) : ''}
            </div>
            <div style={{ display: 'flex', fontFamily: 'Anton', fontSize: 30, color: accent }}>
              TAKASPORTSMEDIA.COM
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: 'Anton', data: anton, weight: 400, style: 'normal' },
        { name: 'Barlow Condensed', data: semi, weight: 600, style: 'normal' },
        { name: 'Barlow Condensed', data: bold, weight: 700, style: 'normal' },
      ],
    },
  )

  try {
    const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    return { body: new Uint8Array(jpeg), type: 'image/jpeg' }
  } catch {
    return { body: png.body, type: 'image/png' }
  }
}
