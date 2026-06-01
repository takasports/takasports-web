import { ImageResponse } from 'next/og'
import { sanityClient } from '@/lib/sanity'

export const alt = 'TakaSports'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600

const SPORT_COLORS: Record<string, string> = {
  futbol:     '#22c55e',
  baloncesto: '#f97316',
  formula1:   '#ef4444',
  ufc:        '#7C3AED',
  tenis:      '#eab308',
  wwe:        '#dc2626',
  rugby:      '#0ea5e9',
}

const OG_QUERY = `*[_type == "article" && (_id == $id || slug.current == $id)][0]{
  title,
  short_summary,
  sport,
  category,
  imageUrl,
}`

// Ver opengraph-image.tsx de noticias/[slug] para el contexto del fix.
async function safeImageUrl(url: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null
  try {
    const r = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000),
      headers: { 'User-Agent': 'Mozilla/5.0 TakaSportsOG/1.0' },
    })
    if (!r.ok) return null
    const ct = r.headers.get('content-type') ?? ''
    if (!ct.startsWith('image/')) return null
    return url
  } catch {
    return null
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const article = await sanityClient
    .fetch<{ title?: string; short_summary?: string; sport?: string; category?: string; imageUrl?: string }>(
      OG_QUERY,
      { id },
    )
    .catch(() => null)

  const title   = article?.title ?? 'TakaSports — Noticias deportivas'
  const summary = article?.short_summary
  const sport   = article?.sport ?? article?.category
  const accent  = sport ? (SPORT_COLORS[sport] ?? '#7C3AED') : '#7C3AED'
  const imgUrl  = await safeImageUrl(article?.imageUrl ?? null)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#09090F',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Hero photo — right half */}
        {imgUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt=""
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '55%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}

        {/* Gradient: left is opaque, blends into photo */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: imgUrl
              ? 'linear-gradient(90deg, #09090F 45%, rgba(9,9,15,0.65) 68%, rgba(9,9,15,0.05) 100%)'
              : `radial-gradient(ellipse 900px 500px at 20% 40%, ${accent}28 0%, transparent 70%)`,
            display: 'flex',
          }}
        />

        {/* Accent glow top-left */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            left: -60,
            width: 520,
            height: 380,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${accent}30 0%, transparent 65%)`,
            display: 'flex',
          }}
        />

        {/* Content column */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '50px 58px',
            width: imgUrl ? '58%' : '100%',
            zIndex: 1,
          }}
        >
          {/* Top: brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#F0F0FF', letterSpacing: '-0.025em' }}>
              TakaSports
            </span>
            <div style={{ width: 5, height: 5, borderRadius: 999, background: accent, display: 'flex' }} />
            <span style={{ fontSize: 16, color: '#6060808', fontWeight: 600 }}>takasportsmedia.com</span>
          </div>

          {/* Middle: sport pill + title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {sport && (
              <div
                style={{
                  display: 'flex',
                  padding: '6px 18px',
                  borderRadius: 999,
                  background: `${accent}22`,
                  border: `1.5px solid ${accent}55`,
                  color: accent,
                  fontSize: 13,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  width: 'fit-content',
                }}
              >
                {sport.toUpperCase()}
              </div>
            )}
            <div
              style={{
                fontSize: title.length > 70 ? 40 : title.length > 50 ? 46 : 52,
                fontWeight: 900,
                color: '#F5F5FF',
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
              }}
            >
              {title.length > 110 ? title.slice(0, 107) + '…' : title}
            </div>
          </div>

          {/* Bottom: summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {summary && (
              <div style={{ fontSize: 19, color: '#8888A8', lineHeight: 1.45 }}>
                {summary.length > 130 ? summary.slice(0, 127) + '…' : summary}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 4,
              }}
            >
              <div style={{ width: 28, height: 2, background: accent, borderRadius: 2, display: 'flex' }} />
              <span style={{ fontSize: 13, color: accent, fontWeight: 700, letterSpacing: '0.05em' }}>
                TAKASPORTS
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
