// ─────────────────────────────────────────────────────────────────
// Render compartido de la OG image de la placa. Lo usan:
//   · /api/og/placa/[userId]/route.tsx  → endpoint público dedicado
//   · /perfil/[userId]/opengraph-image.tsx → convención Next.js que
//     auto-añade <meta property="og:image"> a la página
//   · /perfil/[userId]/twitter-image.tsx → idem para twitter:image
//
// Diseño simplificado (sin clip-path ni conic-gradient — ImageResponse
// no los soporta). Layout split: placa simplificada a la izquierda +
// XP card + badges + branding a la derecha.
// ─────────────────────────────────────────────────────────────────

import { ImageResponse } from 'next/og'

export const OG_WIDTH  = 1200
export const OG_HEIGHT = 630

const TIER_COLORS: Record<string, { primary: string; bg: string; glow: string; label: string }> = {
  bronze:  { primary: '#cd7f32', bg: '#3d240e', glow: 'rgba(205,127,50,0.40)',  label: 'BRONZE' },
  silver:  { primary: '#cbd5e1', bg: '#1c2532', glow: 'rgba(203,213,225,0.35)', label: 'SILVER' },
  gold:    { primary: '#fbbf24', bg: '#3d2a05', glow: 'rgba(251,191,36,0.45)',  label: 'GOLD'   },
  diamond: { primary: '#22d3ee', bg: '#06283a', glow: 'rgba(34,211,238,0.50)',  label: 'DIAMOND'},
}

function tierFromLevel(level: number): keyof typeof TIER_COLORS {
  if (level >= 8) return 'diamond'
  if (level >= 6) return 'gold'
  if (level >= 4) return 'silver'
  return 'bronze'
}

export interface PlacaOGData {
  displayName: string
  handle:      string
  avatarUrl:   string | null
  level:       number
  levelName:   string
  xp:          number
  equipment:   {
    badge?:   { emoji?: string; color: string; bg: string; name: string }
    title?:   { text: string; color: string }
    frame?:   { color: string }
    card_bg?: { gradient: string }
    name_effect?:    { gradient: string }
    corner_sticker?: { iconId: string; color: string }
  }
  badges: { id: string; emoji: string; color: string; bg: string }[]
}

/**
 * Fetch la data del placa de un user para OG. Usa /api/placa/[userId]
 * internamente con URL absoluta (origin).
 */
export async function fetchPlacaForOG(userId: string, origin: string): Promise<PlacaOGData | null> {
  try {
    const res = await fetch(`${origin}/api/placa/${userId}`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json() as PlacaOGData
  } catch {
    return null
  }
}

export function placaFallback(): PlacaOGData {
  return {
    displayName: 'Takero',
    handle: 'takero',
    avatarUrl: null,
    level: 1,
    levelName: 'Novato',
    xp: 0,
    equipment: {},
    badges: [],
  }
}

/**
 * Renderiza la PNG. Retorna directamente ImageResponse — los callers
 * lo devuelven tal cual desde la GET handler / opengraph-image default.
 */
export function renderPlacaOG(data: PlacaOGData, userId: string): ImageResponse {
  const tier = TIER_COLORS[tierFromLevel(data.level)]
  const frameColor = data.equipment.frame?.color ?? tier.primary
  const cardBg = data.equipment.card_bg?.gradient
    ?? `linear-gradient(160deg, #1E1E28 0%, #14141C 45%, #0A0A12 100%)`
  const titleText  = data.equipment.title?.text
  const titleColor = data.equipment.title?.color ?? tier.primary
  const nameGradient = data.equipment.name_effect?.gradient

  const nameParts = data.displayName.trim().split(/\s+/)
  const firstName = nameParts.length > 1 ? nameParts[0] : ''
  const surname   = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0]
  const initials  = (data.displayName.split(' ').map(w => w[0]).join('').slice(0, 2) || '?').toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          width: OG_WIDTH, height: OG_HEIGHT,
          display: 'flex',
          background: '#050508',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Glows ambient tier */}
        <div style={{
          position: 'absolute',
          top: -200, left: -150, width: 720, height: 720,
          background: `radial-gradient(circle, ${tier.glow} 0%, transparent 65%)`,
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -200, right: -200, width: 700, height: 700,
          background: `radial-gradient(circle, ${tier.glow} 0%, transparent 70%)`,
          opacity: 0.55,
          display: 'flex',
        }} />

        {/* PLACA — izquierda */}
        <div style={{
          width: 460,
          margin: '50px 30px 50px 60px',
          display: 'flex', flexDirection: 'column',
          background: cardBg,
          borderRadius: 18,
          border: `3px solid ${frameColor}`,
          boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 50px ${tier.glow}`,
          padding: '32px 28px',
        }}>
          {/* Tier band */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 14px',
            background: `linear-gradient(135deg, ${tier.primary} 0%, ${tier.bg} 50%, ${tier.primary} 100%)`,
            borderRadius: 4,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.45)',
          }}>
            <span style={{
              fontSize: 14, fontWeight: 700,
              letterSpacing: '0.3em', color: '#0A0612',
              textShadow: '0 1px 0 rgba(255,255,255,0.3)',
            }}>
              {tier.label}
            </span>
            <span style={{
              fontSize: 13, fontWeight: 900,
              color: '#0A0612', letterSpacing: '0.06em',
              textShadow: '0 1px 0 rgba(255,255,255,0.3)',
            }}>
              {data.levelName.toUpperCase()}
            </span>
          </div>

          {/* Avatar + LVL */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 32, marginBottom: 24,
          }}>
            <div style={{
              width: 110, height: 110, borderRadius: '50%',
              background: tier.primary, padding: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 30px ${tier.glow}`,
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: '#0A0612',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {data.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={data.avatarUrl} alt="" width={104} height={104}
                    style={{ width: 104, height: 104, objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <span style={{ fontSize: 40, fontWeight: 900, color: tier.primary }}>
                    {initials}
                  </span>
                )}
              </div>
            </div>

            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: `radial-gradient(circle, ${tier.bg} 0%, #0A0612 80%)`,
              border: `3px solid ${tier.primary}`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 24px ${tier.glow}`,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: tier.primary,
                letterSpacing: '0.2em', marginBottom: -2,
              }}>LVL</span>
              <span style={{
                fontSize: 44, fontWeight: 900, color: tier.primary,
                lineHeight: 1, letterSpacing: '-0.04em',
              }}>{data.level}</span>
            </div>
          </div>

          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {firstName && (
              <span style={{
                fontSize: 16, color: '#9090B0',
                letterSpacing: '0.24em', fontWeight: 400,
                textTransform: 'uppercase',
              }}>{firstName}</span>
            )}
            <span style={{
              fontSize: 54, fontWeight: 900,
              color: nameGradient ? 'transparent' : '#F0F0F8',
              letterSpacing: '-0.03em', lineHeight: 0.95,
              textTransform: 'uppercase', marginTop: 4,
              ...(nameGradient ? {
                backgroundImage: nameGradient,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
              } : {
                textShadow: `0 2px 0 rgba(0,0,0,0.6), 0 0 20px ${tier.glow}`,
              }),
            }}>{surname.slice(0, 12)}</span>
          </div>

          {titleText && (
            <div style={{
              marginTop: 16,
              padding: '6px 14px',
              background: `${titleColor}22`,
              borderLeft: `3px solid ${titleColor}`,
              alignSelf: 'flex-start',
              display: 'flex',
            }}>
              <span style={{
                fontSize: 14, color: titleColor,
                letterSpacing: '0.22em', fontWeight: 400,
                textTransform: 'uppercase',
                textShadow: `0 0 10px ${titleColor}80`,
              }}>{titleText}</span>
            </div>
          )}

          <div style={{
            marginTop: 'auto', display: 'flex',
            justifyContent: 'space-between', alignItems: 'flex-end',
            paddingTop: 24, borderTop: `1px solid ${frameColor}33`,
          }}>
            <span style={{ fontSize: 14, color: '#6A6A88', fontWeight: 700 }}>
              @{data.handle}
            </span>
            <span style={{
              fontSize: 14, color: tier.primary, letterSpacing: '0.3em',
              opacity: 0.7, fontWeight: 400,
            }}>TAKA</span>
          </div>
        </div>

        {/* Stats + branding — derecha */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          padding: '70px 60px 50px 30px', gap: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{
              fontSize: 22, fontWeight: 900, color: tier.primary,
              letterSpacing: '0.22em',
            }}>TAKASPORTS</span>
            <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{
              fontSize: 16, color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.16em',
            }}>MI PLACA</span>
          </div>

          <div style={{
            marginTop: 20, padding: '32px 36px', borderRadius: 16,
            background: `${tier.primary}10`,
            border: `2px solid ${tier.primary}40`,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <span style={{
              fontSize: 13, color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.22em', fontWeight: 600,
            }}>XP LIFETIME</span>
            <span style={{
              fontSize: 64, fontWeight: 900,
              color: tier.primary, lineHeight: 1,
              letterSpacing: '-0.02em',
            }}>{data.xp.toLocaleString('es-ES')}</span>
          </div>

          {data.badges.length > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12,
            }}>
              <span style={{
                fontSize: 13, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.22em', fontWeight: 600,
              }}>LOGROS</span>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {data.badges.slice(0, 5).map(b => (
                  <div key={b.id} style={{
                    width: 60, height: 60, borderRadius: 10,
                    background: b.bg, border: `2px solid ${b.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, boxShadow: `0 0 16px ${b.color}40`,
                  }}>{b.emoji || '★'}</div>
                ))}
              </div>
            </div>
          )}

          <div style={{
            marginTop: 'auto', display: 'flex',
            alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 6, height: 32, borderRadius: 3,
              background: tier.primary, display: 'flex',
            }} />
            <span style={{
              fontSize: 16, color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.06em',
            }}>takasportsmedia.com/perfil/{userId.slice(0, 8)}</span>
          </div>
        </div>
      </div>
    ),
    { width: OG_WIDTH, height: OG_HEIGHT }
  )
}
