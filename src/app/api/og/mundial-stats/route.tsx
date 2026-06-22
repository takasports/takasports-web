// GET /api/og/mundial-stats
// Genera imagen PNG compartible con las stats del Mundial de un usuario.
//
// Query params (todos opcionales — si no vienen, muestra placeholders):
//   name    → nombre del usuario
//   picks   → total de predicciones
//   correct → predicciones correctas
//   pts     → puntos acumulados
//   rank    → posición en el ranking (si se conoce)
//
// Uso desde MundialClient:
//   const url = `/api/og/mundial-stats?name=${encodeURIComponent(name)}&picks=${picks}&correct=${correct}&pts=${pts}`
//   navigator.share({ url: 'https://takasportsmedia.com/predicciones', text: '...', ... })
//   // O como imagen en el share:
//   window.open(url) // para preview

import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'

export const runtime     = 'edge'
export const contentType = 'image/png'

const W = 1200
const H = 630

const GOLD  = '#FBBF24'
const GOLD2 = '#F59E0B'
const DARK  = '#0D0900'

function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((n / total) * 100)}%`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // Saneado: la imagen es una tarjeta compartible con cifras que pasa el
  // cliente. No toca el ledger, pero acotamos los valores para evitar
  // tarjetas absurdas/NaN (correctos ≤ picks, sin negativos, tope superior).
  const clampInt = (raw: string | null, lo: number, hi: number): number => {
    const n = parseInt(raw ?? '0', 10)
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo
  }
  const name    = (searchParams.get('name') ?? 'Takero').slice(0, 40)
  const picks   = clampInt(searchParams.get('picks'), 0, 9999)
  const correct = clampInt(searchParams.get('correct'), 0, picks)
  const pts     = clampInt(searchParams.get('pts'), 0, 9_999_999)
  const rankRaw = searchParams.get('rank')
  const rank    = rankRaw ? String(clampInt(rankRaw, 1, 999_999)) : null

  const accuracy = pct(correct, picks)

  return new ImageResponse(
    (
      <div
        style={{
          width:         W,
          height:        H,
          display:       'flex',
          flexDirection: 'column',
          background:    DARK,
          position:      'relative',
          overflow:      'hidden',
          padding:       '56px 72px',
        }}
      >
        {/* Glow dorado top-left */}
        <div style={{
          position: 'absolute', top: -200, left: -150,
          width: 650, height: 550, borderRadius: 9999,
          background: `radial-gradient(circle, ${GOLD}25 0%, transparent 65%)`,
          display: 'flex',
        }} />
        {/* Glow bottom-right */}
        <div style={{
          position: 'absolute', bottom: -150, right: -100,
          width: 500, height: 400, borderRadius: 9999,
          background: `radial-gradient(circle, ${GOLD}10 0%, transparent 65%)`,
          display: 'flex',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, color: GOLD, fontWeight: 900, letterSpacing: '0.15em' }}>
              TAKASPORTS
            </span>
            <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>
              MUNDIAL 2026
            </span>
          </div>
          <span style={{ fontSize: 36 }}>🏆</span>
        </div>

        {/* Centro */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 12 }}>
          {/* Nombre */}
          <div style={{
            fontSize:      52,
            fontWeight:    900,
            color:         '#F0F0F8',
            letterSpacing: '-0.02em',
            lineHeight:    1,
            display:       'flex',
          }}>
            {name}
          </div>

          <div style={{
            fontSize:      22,
            color:         'rgba(255,255,255,0.35)',
            letterSpacing: '0.04em',
            display:       'flex',
            marginBottom:  16,
          }}>
            mis predicciones del Mundial
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 20 }}>
            {/* Picks */}
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              padding:       '20px 28px',
              borderRadius:  16,
              background:    `${GOLD}12`,
              border:        `1.5px solid ${GOLD}30`,
              minWidth:      130,
            }}>
              <span style={{ fontSize: 52, fontWeight: 900, color: GOLD, lineHeight: 1 }}>{picks}</span>
              <span style={{ fontSize: 14, color: GOLD2, marginTop: 4, letterSpacing: '0.06em' }}>PICKS</span>
            </div>

            {/* Correctos */}
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              padding:       '20px 28px',
              borderRadius:  16,
              background:    'rgba(74,222,128,0.08)',
              border:        '1.5px solid rgba(74,222,128,0.25)',
              minWidth:      130,
            }}>
              <span style={{ fontSize: 52, fontWeight: 900, color: '#4ADE80', lineHeight: 1 }}>{correct}</span>
              <span style={{ fontSize: 14, color: 'rgba(74,222,128,0.7)', marginTop: 4, letterSpacing: '0.06em' }}>ACERTOS</span>
            </div>

            {/* Accuracy */}
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              padding:       '20px 28px',
              borderRadius:  16,
              background:    'rgba(255,255,255,0.03)',
              border:        '1.5px solid rgba(255,255,255,0.08)',
              minWidth:      130,
            }}>
              <span style={{ fontSize: 52, fontWeight: 900, color: '#F0F0F8', lineHeight: 1 }}>{accuracy}</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: '0.06em' }}>PRECISIÓN</span>
            </div>

            {/* Puntos */}
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              padding:       '20px 28px',
              borderRadius:  16,
              background:    'rgba(167,139,250,0.08)',
              border:        '1.5px solid rgba(167,139,250,0.25)',
              minWidth:      130,
            }}>
              <span style={{ fontSize: 52, fontWeight: 900, color: '#A78BFA', lineHeight: 1 }}>{pts}</span>
              <span style={{ fontSize: 14, color: 'rgba(167,139,250,0.7)', marginTop: 4, letterSpacing: '0.06em' }}>PUNTOS</span>
            </div>

            {/* Rank (solo si se proporcionó) */}
            {rank && (
              <div style={{
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                padding:       '20px 28px',
                borderRadius:  16,
                background:    `${GOLD}18`,
                border:        `1.5px solid ${GOLD}45`,
                minWidth:      130,
              }}>
                <span style={{ fontSize: 52, fontWeight: 900, color: GOLD, lineHeight: 1 }}>#{rank}</span>
                <span style={{ fontSize: 14, color: GOLD2, marginTop: 4, letterSpacing: '0.06em' }}>RANKING</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 32 }}>
          <div style={{ width: 6, height: 32, borderRadius: 3, background: GOLD, display: 'flex' }} />
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.05em' }}>
            takasportsmedia.com/predicciones
          </span>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      // La imagen depende SOLO de los parámetros de la URL → cacheable en CDN.
      // Antes era force-dynamic: re-render satori (CPU) en cada compartido/apertura.
      // CDN-Cache-Control es la que respeta Vercel para su caché de borde (Next
      // sobrescribe el Cache-Control de cara al navegador en rutas dinámicas).
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  )
}
