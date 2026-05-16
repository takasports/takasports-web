import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

interface SportPreset {
  emoji: string
  label: string
  glow: string       // accent rgba para glow superior
  highlight: string  // chips destacados
  count: string      // texto debajo del título (ej. "20 estadísticas en vivo")
  chips: string[]    // 3-5 sub-temas para chips de fondo
}

const SPORTS: Record<string, SportPreset> = {
  futbol: {
    emoji: '⚽', label: 'FÚTBOL',
    glow: 'rgba(34,197,94,0.30)', highlight: '#22c55e',
    count: '20 estadísticas en vivo',
    chips: ['LaLiga', 'Premier', 'Bundesliga', 'Serie A', 'Champions'],
  },
  baloncesto: {
    emoji: '🏀', label: 'NBA',
    glow: 'rgba(239,68,68,0.30)', highlight: '#ef4444',
    count: '13 estadísticas en vivo',
    chips: ['Este', 'Oeste', 'Anotadores', 'MVP Race', 'Playoffs'],
  },
  f1: {
    emoji: '🏎️', label: 'FÓRMULA 1',
    glow: 'rgba(249,115,22,0.30)', highlight: '#f97316',
    count: '5 estadísticas en vivo',
    chips: ['Pilotos', 'Constructores', 'Sprints', 'Poles', 'Calendario'],
  },
  tenis: {
    emoji: '🎾', label: 'TENIS',
    glow: 'rgba(132,204,22,0.30)', highlight: '#84cc16',
    count: 'ATP · WTA · Grand Slams',
    chips: ['ATP', 'WTA', 'Grand Slams'],
  },
  motogp: {
    emoji: '🏍️', label: 'MOTOGP',
    glow: 'rgba(220,38,38,0.30)', highlight: '#dc2626',
    count: 'Pilotos · Constructores 2026',
    chips: ['Mundial Pilotos', 'Constructores'],
  },
  ufc: {
    emoji: '🥊', label: 'UFC',
    glow: 'rgba(249,115,22,0.30)', highlight: '#f97316',
    count: 'P4P · Campeones por división',
    chips: ['Pound for Pound', 'Campeones'],
  },
  mundial: {
    emoji: '🌍', label: 'MUNDIAL 2026',
    glow: 'rgba(245,158,11,0.30)', highlight: '#f59e0b',
    count: 'Grupos · Clasificados · Goleadores',
    chips: ['12 Grupos', 'Top 16 FIFA', 'Anfitriones'],
  },
}

const DEFAULT: SportPreset = {
  emoji: '⚡', label: 'ESTADÍSTICAS',
  glow: 'rgba(34,197,94,0.30)', highlight: '#22c55e',
  count: '7 deportes · ~58 estadísticas en vivo',
  chips: ['LaLiga', 'NBA', 'F1', 'Tenis', 'UFC', 'MotoGP', 'Mundial 2026'],
}

export async function GET(req: NextRequest) {
  const sportParam = (req.nextUrl.searchParams.get('sport') ?? '').toLowerCase()
  const preset = SPORTS[sportParam] ?? DEFAULT

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090F',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow superior con el color del deporte */}
        <div
          style={{
            position: 'absolute',
            top: -180,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 950,
            height: 580,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${preset.glow} 0%, transparent 65%)`,
            display: 'flex',
          }}
        />

        {/* Live pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 20px',
            background: 'rgba(34,197,94,0.16)',
            border: '1.5px solid rgba(34,197,94,0.4)',
            borderRadius: 9999,
            marginBottom: 24,
            zIndex: 1,
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: 9999, background: '#4ade80', display: 'flex' }} />
          <div style={{ fontSize: 22, color: '#86efac', fontWeight: 800, letterSpacing: '0.18em' }}>
            EN VIVO
          </div>
        </div>

        {/* Emoji + título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, zIndex: 1 }}>
          <div style={{ fontSize: 110 }}>{preset.emoji}</div>
          <div
            style={{
              fontSize: 110,
              fontWeight: 900,
              color: '#F0F0FF',
              letterSpacing: '-0.045em',
              lineHeight: 1,
            }}
          >
            {preset.label}
          </div>
        </div>

        {/* Subtitle: counter */}
        <div
          style={{
            marginTop: 18,
            fontSize: 32,
            color: preset.highlight,
            fontWeight: 700,
            letterSpacing: '0.04em',
            zIndex: 1,
          }}
        >
          {preset.count}
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', gap: 14, marginTop: 36, zIndex: 1, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000 }}>
          {preset.chips.map(label => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 22px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${preset.highlight}40`,
                fontSize: 20,
                fontWeight: 700,
                color: '#D0D0F0',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            right: 48,
            fontSize: 17,
            color: 'rgba(255,255,255,0.20)',
            letterSpacing: '0.05em',
            display: 'flex',
          }}
        >
          takasportsmedia.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
