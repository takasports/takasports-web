'use client'

// /placa-preview — Ruta oculta para revisar visualmente el diseño de
// la PlacaCard. NO está enlazada desde el sitio. Acceso manual.
//
// Muestra V2 (editorial + foil holográfico, dirección elegida) y debajo
// la V1 (versión "standard" inicial) como referencia comparativa.

import { PlacaCard } from '@/components/placa/PlacaCard'
import { PlacaCardV2 } from '@/components/placa/PlacaCardV2'
import type { PlacaData } from '@/components/placa/types'

// Sport accent por variante — simula que el user "sigue" un deporte
const SPORT_ACCENTS = {
  futbol:     '#22c55e',
  baloncesto: '#f59e0b',
  formula1:   '#ef4444',
  ufc:        '#f97316',
}

const VARIANTS: { label: string; description: string; placa: PlacaData; sport: string }[] = [
  // ─── ROOKIE ───────────────────────────────────────────────────
  {
    label: 'Rookie',
    description: 'L3 · Bronze · Solo el badge de bienvenida. Nada de foil pesado.',
    sport: SPORT_ACCENTS.futbol,
    placa: {
      displayName: 'Nuevo Fichaje',
      handle: 'fichaje24',
      level: 3,
      levelName: 'Rookie',
      tier: 'bronze',
      badge: {
        id: 'nuevo_fichaje', emoji: '✍️', name: 'Nuevo fichaje',
        color: '#818cf8', bg: 'rgba(129,140,248,0.18)', rarity: 'common',
      },
    },
  },

  // ─── CRACK ────────────────────────────────────────────────────
  {
    label: 'Crack',
    description: 'L18 · Silver · "El Oráculo", racha 5, foil presente pero contenido.',
    sport: SPORT_ACCENTS.futbol,
    placa: {
      displayName: 'Marta García',
      handle: 'martag',
      level: 18,
      levelName: 'Crack',
      tier: 'silver',
      badge: {
        id: 'oraculo', emoji: '🔮', name: 'Oráculo',
        color: '#a78bfa', bg: 'rgba(167,139,250,0.20)', rarity: 'rare',
      },
      title: { text: 'El Oráculo', color: '#a78bfa' },
      secondaryBadges: [
        { id: 'racha_5', emoji: '🔥', name: 'En llamas', color: '#ef4444', bg: 'rgba(239,68,68,0.18)', rarity: 'epic' },
        { id: 'primera_prediccion_correcta', emoji: '✅', name: 'Primer acierto', color: '#34d399', bg: 'rgba(52,211,153,0.18)', rarity: 'common' },
      ],
      signatureStat: {
        label: 'Aciertos',
        value: '47',
      },
    },
  },

  // ─── MAESTRO ──────────────────────────────────────────────────
  {
    label: 'Maestro',
    description: 'L42 · Gold · Profeta del Mundial. Foil notable, card_bg dorado, corner sticker.',
    sport: SPORT_ACCENTS.baloncesto,
    placa: {
      displayName: 'Diego Velasco',
      handle: 'diegoveloz',
      level: 42,
      levelName: 'Maestro',
      tier: 'gold',
      badge: {
        id: 'profeta_mundial_2026', emoji: '🔮', name: 'Profeta del Mundial',
        color: '#fbbf24', bg: 'rgba(251,191,36,0.22)', rarity: 'legendary',
      },
      title: { text: 'El Profeta', color: '#fbbf24' },
      frame: { color: '#fbbf24' },
      cardBg: {
        gradient: 'linear-gradient(160deg, #1a0f00 0%, #2d1a00 45%, #06060E 100%)',
      },
      cornerSticker: { emoji: '🏆', color: '#fbbf24' },
      avatarFrame: { color: '#fbbf24', style: 'gradient' },
      nameEffect: {
        gradient: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 50%, #b45309 100%)',
      },
      secondaryBadges: [
        { id: 'mundialista_2026', emoji: '🌍', name: 'Mundialista', color: '#22c55e', bg: 'rgba(34,197,94,0.18)', rarity: 'rare' },
        { id: 'pleno_jornada', emoji: '🎯', name: 'Pleno', color: '#fbbf24', bg: 'rgba(251,191,36,0.20)', rarity: 'epic' },
      ],
      signatureStat: {
        label: 'Plenos',
        value: 'x3',
      },
    },
  },

  // ─── LEYENDA ──────────────────────────────────────────────────
  {
    label: 'Leyenda',
    description: 'L60 · Diamond · TOP 3 Mundial, foil máximo, name effect arco iris.',
    sport: SPORT_ACCENTS.formula1,
    placa: {
      displayName: 'Ana Suárez',
      handle: 'anasleyenda',
      level: 60,
      levelName: 'Leyenda',
      tier: 'diamond',
      badge: {
        id: 'top3_mundial_2026', emoji: '🏆', name: 'Podio Mundial 2026',
        color: '#fbbf24', bg: 'rgba(251,191,36,0.25)', rarity: 'legendary',
      },
      title: { text: 'Podio Mundial', color: '#fbbf24' },
      frame: { color: '#22d3ee' },
      cardBg: {
        gradient: 'linear-gradient(160deg, #001a26 0%, #1a0033 45%, #260011 80%, #06060E 100%)',
      },
      cornerSticker: { emoji: '👑', color: '#fbbf24' },
      avatarFrame: { color: '#22d3ee', style: 'gradient' },
      nameEffect: {
        gradient: 'linear-gradient(90deg, #22d3ee 0%, #c084fc 50%, #fbbf24 100%)',
      },
      secondaryBadges: [
        { id: 'profeta_mundial_2026', emoji: '🔮', name: 'Profeta', color: '#fbbf24', bg: 'rgba(251,191,36,0.22)', rarity: 'legendary' },
        { id: 'champion_weekly', emoji: '👑', name: 'Campeón semanal', color: '#fbbf24', bg: 'rgba(251,191,36,0.22)', rarity: 'epic' },
      ],
      signatureStat: {
        label: 'Mundial',
        value: '#2',
      },
    },
  },
]

export default function PlacaPreviewPage() {
  return (
    <main
      className="min-h-screen"
      style={{
        background: 'radial-gradient(circle at 50% 0%, #0F0820 0%, #06060E 80%)',
        padding: '60px 24px 100px',
      }}
    >
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-12 text-center">
          <p
            className="uppercase tracking-[0.3em] mb-2"
            style={{ color: '#7A7A92', fontSize: 11, fontFamily: 'var(--font-sport)', fontWeight: 800 }}
          >
            Mockup — Iteración V2
          </p>
          <h1
            className="text-4xl font-black mb-2"
            style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
          >
            Placa personal
          </h1>
          <p
            className="max-w-[720px] mx-auto"
            style={{ color: '#9090B0', fontSize: 14, fontFamily: 'var(--font-sport)', lineHeight: 1.6 }}
          >
            Dirección editorial + foil holográfico. Pasa el cursor sobre una placa para ver el tilt 3D y el foil paralax.
            La intensidad del foil escala con el tier: bronze casi mate → diamond máximo.
          </p>
        </header>

        {/* V2 — DIRECCIÓN ELEGIDA */}
        <section className="mb-20">
          <div className="flex items-center justify-center gap-3 mb-8">
            <span style={{ height: 1, flex: 1, maxWidth: 80, background: 'rgba(167,139,250,0.3)' }} />
            <p
              className="uppercase tracking-[0.28em]"
              style={{ color: '#A78BFA', fontSize: 11, fontFamily: 'var(--font-headline)' }}
            >
              V2 · Editorial holográfico
            </p>
            <span style={{ height: 1, flex: 1, maxWidth: 80, background: 'rgba(167,139,250,0.3)' }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-10 place-items-center">
            {VARIANTS.map(v => (
              <div key={v.label} className="flex flex-col items-center gap-4">
                <PlacaCardV2 placa={v.placa} sportAccent={v.sport} />
                <div className="text-center max-w-[300px]">
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 14, fontWeight: 900,
                      color: '#F0F0F8',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {v.label}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-sport)',
                      fontSize: 11, color: '#7A7A92',
                      marginTop: 4, lineHeight: 1.4,
                    }}
                  >
                    {v.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* V1 — referencia */}
        <section className="mb-12">
          <div className="flex items-center justify-center gap-3 mb-8">
            <span style={{ height: 1, flex: 1, maxWidth: 80, background: 'rgba(255,255,255,0.08)' }} />
            <p
              className="uppercase tracking-[0.28em]"
              style={{ color: '#5A5A78', fontSize: 11, fontFamily: 'var(--font-headline)' }}
            >
              V1 · Versión inicial (referencia)
            </p>
            <span style={{ height: 1, flex: 1, maxWidth: 80, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 place-items-center" style={{ opacity: 0.7 }}>
            {VARIANTS.map(v => (
              <PlacaCard key={v.label} placa={v.placa} size="full" />
            ))}
          </div>
        </section>

        {/* Leyenda */}
        <section
          className="rounded-2xl p-6 mt-12"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            maxWidth: 820, margin: '60px auto 0',
          }}
        >
          <h2
            className="text-lg font-black mb-3"
            style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)' }}
          >
            Qué cambia entre V1 y V2
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" style={{ fontSize: 12, color: '#9090B0', fontFamily: 'var(--font-sport)', lineHeight: 1.5 }}>
            <li><strong style={{ color: '#C4B5FD' }}>Tipografía dramática</strong> — nombre 44-50px condensado, no 22px.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Layout asimétrico</strong> — todo a la izquierda, no centrado.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Stripe deportiva</strong> — color del deporte que sigue el user.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Foil holográfico</strong> — conic-gradient con paralax al cursor.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Tilt 3D</strong> — la card se inclina siguiendo el cursor.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Stat line tipo cromo</strong> — 3 columnas (LVL · stat · logros).</li>
            <li><strong style={{ color: '#C4B5FD' }}>Texturas reales</strong> — noise SVG + líneas de cancha.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Tier por material</strong> — foil intensidad escala bronze→diamond.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Sticker rotado</strong> — diecut afuera del borde (gold/diamond).</li>
            <li><strong style={{ color: '#C4B5FD' }}>LVL metal foil</strong> — gradient metálico en el número.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
