'use client'

// /placa-preview — Mockup de la placa personal. Ruta oculta.
//
// V3 destacada arriba (vertical full + horizontal ranking row).
// V2 y V1 colapsadas debajo como histórico de iteración.

import { useState } from 'react'
import { PlacaCard } from '@/components/placa/PlacaCard'
import { PlacaCardV2 } from '@/components/placa/PlacaCardV2'
import { PlacaCardV3 } from '@/components/placa/PlacaCardV3'
import { PlacaCardV4 } from '@/components/placa/PlacaCardV4'
import { PlacaRowV3 } from '@/components/placa/PlacaRowV3'
import type { PlacaData } from '@/components/placa/types'

const SPORT_ACCENTS = {
  futbol:     '#22c55e',
  baloncesto: '#f59e0b',
  formula1:   '#ef4444',
  ufc:        '#f97316',
  tenis:      '#d97706',
}

type SportArt = 'futbol' | 'basket' | 'f1' | 'ufc' | 'tenis' | 'rugby' | 'none'

interface Variant {
  label: string
  description: string
  placa: PlacaData
  sport: string
  sportArt: SportArt
  score: number
}

const VARIANTS: Variant[] = [
  // ── ROOKIE ────────────────────────────────────────────────────
  {
    label: 'Rookie',
    description: 'L3 · Bronze · sport stripe verde fútbol. Casi sin foil, silueta simple, sin sticker.',
    sport: SPORT_ACCENTS.futbol,
    sportArt: 'futbol',
    score: 120,
    placa: {
      displayName: 'Pablo Ramírez',
      handle: 'pabloramz',
      level: 3,
      levelName: 'Rookie',
      tier: 'bronze',
      badge: {
        id: 'nuevo_fichaje', emoji: '✍️', name: 'Nuevo fichaje',
        color: '#818cf8', bg: 'rgba(129,140,248,0.18)', rarity: 'common',
      },
      signatureStat: { label: 'PARTIDOS', value: '5' },
    },
  },

  // ── CRACK ─────────────────────────────────────────────────────
  {
    label: 'Crack',
    description: 'L18 · Silver · sigue NBA. Title chevron equipado, foil sutil, racha 5 + primer acierto.',
    sport: SPORT_ACCENTS.baloncesto,
    sportArt: 'basket',
    score: 2450,
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
      signatureStat: { label: 'ACIERTOS', value: '47' },
    },
  },

  // ── MAESTRO ───────────────────────────────────────────────────
  {
    label: 'Maestro',
    description: 'L42 · Gold · sigue F1. Foil notable, card_bg dorada, name gradient áureo, sticker trofeo.',
    sport: SPORT_ACCENTS.formula1,
    sportArt: 'f1',
    score: 8740,
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
      cardBg: { gradient: 'linear-gradient(160deg, #1a0f00 0%, #2d1a00 45%, #06060E 100%)' },
      cornerSticker: { iconId: 'trophy', color: '#fbbf24' },
      avatarFrame: { color: '#fbbf24', style: 'gradient' },
      nameEffect: {
        gradient: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 50%, #b45309 100%)',
      },
      secondaryBadges: [
        { id: 'mundialista_2026', emoji: '🌍', name: 'Mundialista', color: '#22c55e', bg: 'rgba(34,197,94,0.18)', rarity: 'rare' },
        { id: 'pleno_jornada', emoji: '🎯', name: 'Pleno', color: '#fbbf24', bg: 'rgba(251,191,36,0.20)', rarity: 'epic' },
      ],
      signatureStat: { label: 'PLENOS', value: 'x3' },
    },
  },

  // ── LEYENDA ───────────────────────────────────────────────────
  {
    label: 'Leyenda',
    description: 'L60 · Diamond · sigue UFC. Foil máximo, name arco iris, sticker corona, octágono fondo.',
    sport: SPORT_ACCENTS.ufc,
    sportArt: 'ufc',
    score: 24890,
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
      cardBg: { gradient: 'linear-gradient(160deg, #001a26 0%, #1a0033 45%, #260011 80%, #06060E 100%)' },
      cornerSticker: { iconId: 'crown', color: '#fbbf24' },
      avatarFrame: { color: '#22d3ee', style: 'gradient' },
      nameEffect: {
        gradient: 'linear-gradient(90deg, #22d3ee 0%, #c084fc 50%, #fbbf24 100%)',
      },
      secondaryBadges: [
        { id: 'profeta_mundial_2026', emoji: '🔮', name: 'Profeta', color: '#fbbf24', bg: 'rgba(251,191,36,0.22)', rarity: 'legendary' },
        { id: 'champion_weekly', emoji: '👑', name: 'Campeón semanal', color: '#fbbf24', bg: 'rgba(251,191,36,0.22)', rarity: 'epic' },
      ],
      signatureStat: { label: 'MUNDIAL', value: '#2' },
    },
  },
]

export default function PlacaPreviewPage() {
  const [showHistory, setShowHistory] = useState(false)

  return (
    <main
      className="min-h-screen"
      style={{
        // Página = obsidiana profunda con un solo spotlight muy sutil desde
        // arriba. Sin gradientes coloreados que compitan con las cards.
        // El contraste con el bg de las cards (más claro) hace que floten.
        background: `
          radial-gradient(ellipse 50% 30% at 50% 0%, rgba(255,255,255,0.022) 0%, transparent 60%),
          #050508
        `,
        padding: '60px 24px 100px',
      }}
    >
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-14 text-center">
          <p
            className="uppercase tracking-[0.3em] mb-2"
            style={{ color: '#7A7A92', fontSize: 11, fontFamily: 'var(--font-sport)', fontWeight: 800 }}
          >
            Mockup · V3
          </p>
          <h1
            className="text-4xl font-black mb-2"
            style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
          >
            Placa personal
          </h1>
          <p
            className="max-w-[760px] mx-auto"
            style={{ color: '#9090B0', fontSize: 14, fontFamily: 'var(--font-sport)', lineHeight: 1.6 }}
          >
            Dirección 2K llevada hasta el final: silueta con cortes asimétricos, avatar hexagonal,
            LVL diamante, panel de stats parallelogram con foil interno, arte vectorial del deporte
            favorito al fondo. Pasa el cursor por encima — tilt 3D + foil paralax solo en la vertical.
          </p>
        </header>

        {/* ── V4 DEFINITIVA — la del perfil real (foil gold/diamond) ── */}
        <section className="mb-20">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span style={{ height: 1, flex: 1, maxWidth: 100, background: 'rgba(251,191,36,0.4)' }} />
            <p className="uppercase tracking-[0.28em]" style={{ color: '#FBBF24', fontSize: 11, fontFamily: 'var(--font-headline)' }}>
              V4 · Definitiva (perfil)
            </p>
            <span style={{ height: 1, flex: 1, maxWidth: 100, background: 'rgba(251,191,36,0.4)' }} />
          </div>
          <p className="text-center max-w-[680px] mx-auto mb-8" style={{ color: '#9090B0', fontSize: 13, fontFamily: 'var(--font-sport)', lineHeight: 1.6 }}>
            Look editorial limpio. <strong style={{ color: '#FBBF24' }}>Foil holográfico solo en Gold y Diamond</strong> como
            recompensa premium: pasa el cursor por encima — la lámina iridiscente y el brillo siguen al puntero (0 KB, puro CSS).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-12 place-items-center">
            {VARIANTS.map(v => (
              <div key={v.label} className="flex flex-col items-center gap-4">
                <PlacaCardV4 placa={v.placa} />
                <div className="text-center max-w-[300px]">
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900, color: '#F0F0F8' }}>
                    {v.label} · {v.placa.tier}
                  </p>
                  <p style={{ fontFamily: 'var(--font-sport)', fontSize: 11, color: '#7A7A92', marginTop: 4 }}>
                    {v.placa.tier === 'gold' || v.placa.tier === 'diamond' ? 'Con foil holográfico premium' : 'Sin foil (look limpio)'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── V3 VERTICAL — full ─────────────────────────────────── */}
        <section className="mb-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <span style={{ height: 1, flex: 1, maxWidth: 100, background: 'rgba(167,139,250,0.4)' }} />
            <p className="uppercase tracking-[0.28em]" style={{ color: '#A78BFA', fontSize: 11, fontFamily: 'var(--font-headline)' }}>
              V3 · Vista perfil
            </p>
            <span style={{ height: 1, flex: 1, maxWidth: 100, background: 'rgba(167,139,250,0.4)' }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-12 place-items-center">
            {VARIANTS.map(v => (
              <div key={v.label} className="flex flex-col items-center gap-4">
                <PlacaCardV3 placa={v.placa} sportAccent={v.sport} sportArt={v.sportArt} />
                <div className="text-center max-w-[320px]">
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 14, fontWeight: 900,
                    color: '#F0F0F8', letterSpacing: '-0.01em',
                  }}>
                    {v.label}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-sport)',
                    fontSize: 11, color: '#7A7A92',
                    marginTop: 4, lineHeight: 1.45,
                  }}>
                    {v.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── V3 HORIZONTAL — ranking ─────────────────────────────── */}
        <section className="mb-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <span style={{ height: 1, flex: 1, maxWidth: 100, background: 'rgba(167,139,250,0.4)' }} />
            <p className="uppercase tracking-[0.28em]" style={{ color: '#A78BFA', fontSize: 11, fontFamily: 'var(--font-headline)' }}>
              V3 · Vista ranking
            </p>
            <span style={{ height: 1, flex: 1, maxWidth: 100, background: 'rgba(167,139,250,0.4)' }} />
          </div>

          <div className="flex flex-col items-center gap-4 max-w-[600px] mx-auto">
            {VARIANTS.map((v, i) => (
              <PlacaRowV3
                key={v.label}
                placa={v.placa}
                rank={i + 1}
                score={v.score}
                scoreLabel={v.placa.signatureStat?.label ?? 'pts'}
                sportAccent={v.sport}
              />
            ))}
          </div>
          <p
            className="text-center mt-6"
            style={{ color: '#5A5A78', fontSize: 11, fontFamily: 'var(--font-sport)' }}
          >
            Las filas mantienen el lenguaje visual de la card pero a 88px de alto · foil estático sin paralax (50 rows no pueden hacer cómputo de cursor).
          </p>
        </section>

        {/* ── Histórico colapsable ────────────────────────────────── */}
        <section className="mt-20">
          <div className="text-center mb-8">
            <button
              type="button"
              onClick={() => setShowHistory(s => !s)}
              className="text-[10px] uppercase tracking-[0.28em] transition-opacity hover:opacity-80"
              style={{
                color: '#6A6A88',
                fontFamily: 'var(--font-headline)',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '8px 18px',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              {showHistory ? 'Ocultar iteraciones anteriores' : 'Ver V1 y V2 (histórico iteración)'}
            </button>
          </div>

          {showHistory && (
            <div style={{ opacity: 0.6 }}>
              {/* V2 */}
              <div className="mb-10">
                <p className="text-center mb-6 uppercase tracking-[0.24em]" style={{ color: '#5A5A78', fontSize: 10, fontFamily: 'var(--font-headline)' }}>
                  V2 · Editorial holográfico (anterior)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 place-items-center">
                  {VARIANTS.map(v => (
                    <PlacaCardV2 key={v.label} placa={v.placa} sportAccent={v.sport} interactive={false} />
                  ))}
                </div>
              </div>

              {/* V1 */}
              <div className="mb-10">
                <p className="text-center mb-6 uppercase tracking-[0.24em]" style={{ color: '#5A5A78', fontSize: 10, fontFamily: 'var(--font-headline)' }}>
                  V1 · Versión inicial "standard"
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 place-items-center">
                  {VARIANTS.map(v => (
                    <PlacaCard key={v.label} placa={v.placa} size="full" />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Notas técnicas ──────────────────────────────────────── */}
        <section
          className="rounded-2xl p-6 mt-16"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            maxWidth: 860, margin: '60px auto 0',
          }}
        >
          <h2 className="text-lg font-black mb-3" style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)' }}>
            Qué hace V3 distinta
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" style={{ fontSize: 12, color: '#9090B0', fontFamily: 'var(--font-sport)', lineHeight: 1.55 }}>
            <li><strong style={{ color: '#C4B5FD' }}>Silueta no-rectangular</strong> — cortes asimétricos top-right y bottom-left (clip-path polygon).</li>
            <li><strong style={{ color: '#C4B5FD' }}>Avatar hexagonal</strong> — geometría que evoca cromos / 2K.</li>
            <li><strong style={{ color: '#C4B5FD' }}>LVL diamante</strong> — número en geometría rombo con foil metálico.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Stat panel parallelogram</strong> — clip-path inclinado + foil interno.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Title chevron banner</strong> — apunta hacia adelante como en cromos.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Arte vectorial deportivo</strong> — silueta del deporte favorito tras el avatar.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Nombre como dorsal</strong> — apellido 54px, primer nombre arriba pequeño.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Tier stamp metálico</strong> — gradient embossed con inset shadows.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Versión horizontal</strong> — mismo lenguaje en 88px para ranking listings.</li>
            <li><strong style={{ color: '#C4B5FD' }}>Foil paralax + tilt 3D</strong> — solo en vertical (rendimiento).</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
