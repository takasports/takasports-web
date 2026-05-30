// OG image dinámica para /predicciones — Mundial 2026.
// Next.js genera /predicciones/opengraph-image automáticamente y lo
// enlaza en los meta tags de la página.
// Runtime edge para que el countdown sea fresco en cada crawl.

import { ImageResponse } from 'next/og'
import { OG_SIZE } from '@/lib/og-game-image'

export const runtime     = 'edge'
export const alt         = 'Mundial 2026 — Predice en TakaSports'
export const size        = OG_SIZE
export const contentType = 'image/png'

const GOLD  = '#FBBF24'
const GOLD2 = '#F59E0B'
const DARK  = '#0E0900'

function daysLeft(): number | null {
  const kickoff = new Date('2026-06-11T19:00:00Z')
  const now     = new Date()
  if (now >= kickoff) return null
  return Math.ceil((kickoff.getTime() - now.getTime()) / 86_400_000)
}

export default function Image() {
  const days = daysLeft()

  return new ImageResponse(
    (
      <div
        style={{
          width:          '100%',
          height:         '100%',
          display:        'flex',
          flexDirection:  'column',
          background:     DARK,
          position:       'relative',
          overflow:       'hidden',
          padding:        '60px 80px',
        }}
      >
        {/* Glow dorado top-left */}
        <div style={{
          position:     'absolute',
          top:          -180,
          left:         -120,
          width:        700,
          height:       600,
          borderRadius: 9999,
          background:   `radial-gradient(circle, ${GOLD}28 0%, transparent 65%)`,
          display:      'flex',
        }} />
        {/* Glow sutil bottom-right */}
        <div style={{
          position:     'absolute',
          bottom:       -120,
          right:        -80,
          width:        500,
          height:       400,
          borderRadius: 9999,
          background:   'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 65%)',
          display:      'flex',
        }} />

        {/* Header: marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'auto' }}>
          <span style={{ fontSize: 22, color: GOLD, fontWeight: 900, letterSpacing: '0.15em' }}>
            TAKASPORTS
          </span>
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.2)' }}>·</span>
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
            PREDICCIONES
          </span>
        </div>

        {/* Centro: trofeo + título + subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 20 }}>
          <div style={{ fontSize: 110, lineHeight: 1, display: 'flex' }}>🏆</div>

          <div style={{
            fontSize:      80,
            fontWeight:    900,
            color:         GOLD,
            letterSpacing: '-0.03em',
            lineHeight:    1,
            display:       'flex',
          }}>
            Mundial 2026
          </div>

          <div style={{
            fontSize:  36,
            color:     'rgba(255,255,255,0.55)',
            lineHeight: 1.3,
            display:   'flex',
          }}>
            Predice cada partido · Compite en el ranking · Gana badges
          </div>

          {/* Countdown pill — solo antes del 11 jun */}
          {days !== null && (
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          16,
              marginTop:    8,
            }}>
              <div style={{
                display:        'flex',
                alignItems:     'center',
                gap:            10,
                padding:        '12px 24px',
                borderRadius:   16,
                background:     `${GOLD}18`,
                border:         `1.5px solid ${GOLD}40`,
              }}>
                <span style={{ fontSize: 52, fontWeight: 900, color: GOLD, lineHeight: 1 }}>
                  {days}
                </span>
                <span style={{ fontSize: 22, color: GOLD2, letterSpacing: '0.05em' }}>
                  {days === 1 ? 'DÍA' : 'DÍAS'}
                </span>
              </div>
              <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)' }}>
                para el primer pitazo
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 32 }}>
          <div style={{
            width:        6,
            height:       36,
            borderRadius: 3,
            background:   GOLD,
            display:      'flex',
          }} />
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>
            takasportsmedia.com
          </span>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  )
}
