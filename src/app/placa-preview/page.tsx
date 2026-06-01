'use client'

// /placa-preview — Ruta oculta para revisar visualmente el diseño de
// la PlacaCard. NO está enlazada desde el sitio. Acceso manual por URL.
//
// Muestra 4 variantes que representan el ciclo de progresión del user:
//   · Rookie (L3, bronze) — empezando, casi sin cosméticos
//   · Crack (L18, silver) — un par de logros, un title equipado
//   · Maestro (L42, gold) — placa rica, varios slots ocupados
//   · Leyenda (L60, diamond) — todos los slots, cosméticos legendarios
//
// La idea es validar visualmente la dirección antes de tocar DB ni
// catálogo de cosméticos.

import { PlacaCard } from '@/components/placa/PlacaCard'
import type { PlacaData } from '@/components/placa/types'

const VARIANTS: { label: string; description: string; placa: PlacaData }[] = [
  // ─── ROOKIE ───────────────────────────────────────────────────
  {
    label: 'Rookie',
    description: 'L3 · Bronze · Recién registrado, un badge de bienvenida, sin title equipado.',
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
    description: 'L18 · Silver · "El Oráculo" desbloqueado, racha de 5, signature stat de aciertos.',
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
        label: 'Aciertos esta temporada',
        value: '47',
        emoji: '🎯',
      },
      backgroundPattern: 'dots',
    },
  },

  // ─── MAESTRO ──────────────────────────────────────────────────
  {
    label: 'Maestro',
    description: 'L42 · Gold · Profeta del Mundial. Frame épico, card_bg legendario, sticker de campeón.',
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
        gradient: 'linear-gradient(165deg, #1a0f00 0%, #2d1a00 40%, #0a0612 100%)',
      },
      cornerSticker: { emoji: '🏆', color: '#fbbf24' },
      avatarFrame: { color: '#fbbf24', style: 'gradient' },
      nameEffect: {
        gradient: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 50%, #b45309 100%)',
        glow: 'rgba(251,191,36,0.45)',
      },
      secondaryBadges: [
        { id: 'mundialista_2026', emoji: '🌍', name: 'Mundialista', color: '#22c55e', bg: 'rgba(34,197,94,0.18)', rarity: 'rare' },
        { id: 'pleno_jornada', emoji: '🎯', name: 'Pleno', color: '#fbbf24', bg: 'rgba(251,191,36,0.20)', rarity: 'epic' },
      ],
      signatureStat: {
        label: 'Plenos conseguidos',
        value: 'x3',
        emoji: '⚡',
      },
      backgroundPattern: 'lines',
    },
  },

  // ─── LEYENDA ──────────────────────────────────────────────────
  {
    label: 'Leyenda',
    description: 'L60 · Diamond · TOP 3 Mundial, todos los slots ocupados, name effect arco iris.',
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
        gradient: 'linear-gradient(165deg, #001a26 0%, #1a0033 40%, #260011 80%, #0a0612 100%)',
      },
      cornerSticker: { emoji: '👑', color: '#fbbf24' },
      avatarFrame: { color: '#22d3ee', style: 'gradient' },
      nameEffect: {
        gradient: 'linear-gradient(90deg, #22d3ee 0%, #c084fc 50%, #fbbf24 100%)',
        glow: 'rgba(192,132,252,0.55)',
      },
      secondaryBadges: [
        { id: 'profeta_mundial_2026', emoji: '🔮', name: 'Profeta', color: '#fbbf24', bg: 'rgba(251,191,36,0.22)', rarity: 'legendary' },
        { id: 'champion_weekly', emoji: '👑', name: 'Campeón semanal', color: '#fbbf24', bg: 'rgba(251,191,36,0.22)', rarity: 'epic' },
      ],
      signatureStat: {
        label: 'Posición Mundial 2026',
        value: '#2',
        emoji: '🥈',
      },
      backgroundPattern: 'stripes',
    },
  },
]

export default function PlacaPreviewPage() {
  return (
    <main
      className="min-h-screen"
      style={{
        background: 'radial-gradient(circle at center, #0F0820 0%, #06060E 80%)',
        padding: '60px 24px',
      }}
    >
      <div className="max-w-[1200px] mx-auto">
        <header className="mb-10 text-center">
          <p
            className="uppercase tracking-[0.3em] mb-2"
            style={{ color: '#7A7A92', fontSize: 11, fontFamily: 'var(--font-sport)', fontWeight: 800 }}
          >
            Mockup
          </p>
          <h1
            className="text-4xl font-black mb-2"
            style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
          >
            Placa personal · Diseño en papel
          </h1>
          <p
            className="max-w-[640px] mx-auto"
            style={{ color: '#9090B0', fontSize: 13, fontFamily: 'var(--font-sport)' }}
          >
            La placa reúne todos los cosméticos equipados del usuario en una tarjeta vertical.
            Cada variante muestra cómo escala la personalización con el progreso.
          </p>
        </header>

        {/* Tamaño full — fila principal */}
        <section className="mb-16">
          <p
            className="uppercase tracking-[0.22em] mb-6 text-center"
            style={{ color: '#A78BFA', fontSize: 10, fontFamily: 'var(--font-sport)', fontWeight: 900 }}
          >
            Vista completa (perfil)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 place-items-center">
            {VARIANTS.map(v => (
              <div key={v.label} className="flex flex-col items-center gap-3">
                <PlacaCard placa={v.placa} size="full" />
                <div className="text-center max-w-[280px]">
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

        {/* Tamaño compact — para ranking */}
        <section className="mb-12">
          <p
            className="uppercase tracking-[0.22em] mb-6 text-center"
            style={{ color: '#A78BFA', fontSize: 10, fontFamily: 'var(--font-sport)', fontWeight: 900 }}
          >
            Vista compacta (mockup ranking)
          </p>
          <div className="flex flex-wrap gap-6 justify-center">
            {VARIANTS.map(v => (
              <PlacaCard key={v.label} placa={v.placa} size="compact" />
            ))}
          </div>
        </section>

        {/* Leyenda de slots */}
        <section
          className="rounded-2xl p-6 mt-8"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            maxWidth: 760, margin: '40px auto 0',
          }}
        >
          <h2
            className="text-lg font-black mb-3"
            style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)' }}
          >
            Slots de personalización
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ fontSize: 12, color: '#9090B0', fontFamily: 'var(--font-sport)' }}>
            <div><strong style={{ color: '#C4B5FD' }}>tier_metal</strong> — bronce / plata / oro / diamante por nivel</div>
            <div><strong style={{ color: '#C4B5FD' }}>badge</strong> — chip primario grande</div>
            <div><strong style={{ color: '#C4B5FD' }}>title</strong> — epíteto bajo el nombre</div>
            <div><strong style={{ color: '#C4B5FD' }}>frame</strong> — color del borde de la placa</div>
            <div><strong style={{ color: '#C4B5FD' }}>card_bg</strong> — gradiente del fondo</div>
            <div><strong style={{ color: '#C4B5FD' }}>avatar_frame</strong> — anillo del avatar</div>
            <div><strong style={{ color: '#C4B5FD' }}>name_effect</strong> — gradient / glow del nombre</div>
            <div><strong style={{ color: '#C4B5FD' }}>corner_sticker</strong> — pegatina decorativa esquina</div>
            <div><strong style={{ color: '#C4B5FD' }}>signature_stat</strong> — stat firmado (ej: Plenos x3)</div>
            <div><strong style={{ color: '#C4B5FD' }}>background_pattern</strong> — textura sutil overlay</div>
            <div><strong style={{ color: '#C4B5FD' }}>secondary_badges</strong> — hasta 2 chips bajo el primario</div>
          </div>
          <p
            className="mt-4 text-xs"
            style={{ color: '#5A5A78', fontFamily: 'var(--font-sport)', lineHeight: 1.5 }}
          >
            En negrita los nuevos slots propuestos (no existen en DB todavía).
            Los actuales en DB: <code>badge</code>, <code>title</code>, <code>frame</code>, <code>card_bg</code>.
          </p>
        </section>
      </div>
    </main>
  )
}
