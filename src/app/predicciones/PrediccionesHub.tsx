'use client'

// ── PrediccionesHub ─────────────────────────────────────────────────
// Hub principal de predicciones. Tres tabs superiores:
//   1. Ranked         → selector de deporte + contenido de predicciones
//   2. Ligas Creadores → próximamente
//   3. Ligas Privadas  → próximamente
//
// El tab Ranked muestra un selector de sport. El deporte activo
// renderiza su cliente correspondiente (QuinielaClient para fútbol,
// placeholders para el resto).

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'

// Carga dinámica — QuinielaClient es pesado, solo se carga si se activa fútbol
const QuinielaClient = dynamic(
  () => import('@/app/quiniela/QuinielaClient'),
  { ssr: false, loading: () => <QuinielaLoadingShim /> }
)

// ── Tipos ────────────────────────────────────────────────────────────
type HubTab   = 'ranked' | 'creadores' | 'privadas'
type SportTab = 'futbol' | 'ufc' | 'mundial'

// ── Sports config ────────────────────────────────────────────────────
const SPORTS: {
  id: SportTab
  label: string
  emoji: string
  accent: string
  available: boolean
  badge?: string
}[] = [
  {
    id:        'mundial',
    label:     'Mundial 2026',
    emoji:     '🏆',
    accent:    '#FBBF24',
    available: false,
    badge:     'Pronto',
  },
  {
    id:        'futbol',
    label:     'Ranked Fútbol',
    emoji:     '⚽',
    accent:    '#4ADE80',
    available: true,
  },
  {
    id:        'ufc',
    label:     'Ranked UFC',
    emoji:     '🥊',
    accent:    '#F87171',
    available: false,
    badge:     'Pronto',
  },
]

// ── Componente principal ─────────────────────────────────────────────
export default function PrediccionesHub() {
  const [hubTab,   setHubTab]   = useState<HubTab>('ranked')
  const [sportTab, setSportTab] = useState<SportTab>('futbol')

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />

      {/* ── Hub tabs ──────────────────────────────────────────────── */}
      <div
        className="sticky top-[48px] z-30 border-b"
        style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10">
          <div className="flex gap-0 overflow-x-auto scrollbar-none">
            {(
              [
                { id: 'ranked' as HubTab,    label: 'Ranked' },
                { id: 'creadores' as HubTab, label: 'Ligas Creadores' },
                { id: 'privadas' as HubTab,  label: 'Ligas Privadas' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setHubTab(tab.id)}
                className="relative flex-shrink-0 px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-colors"
                style={{
                  color: hubTab === tab.id ? '#F0F0F8' : 'var(--text-muted)',
                  fontFamily: 'var(--font-sport)',
                  borderBottom: hubTab === tab.id
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido ─────────────────────────────────────────────── */}
      {hubTab === 'ranked' && (
        <>
          {/* Sport selector */}
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pt-4 pb-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {SPORTS.map(sport => (
                <button
                  key={sport.id}
                  onClick={() => sport.available && setSportTab(sport.id)}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                  style={{
                    background: sportTab === sport.id && sport.available
                      ? `${sport.accent}18`
                      : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${
                      sportTab === sport.id && sport.available
                        ? `${sport.accent}50`
                        : 'rgba(255,255,255,0.06)'
                    }`,
                    color: sport.available
                      ? sportTab === sport.id ? sport.accent : 'var(--text-muted)'
                      : '#3A3A52',
                    cursor: sport.available ? 'pointer' : 'default',
                    fontFamily: 'var(--font-sport)',
                    opacity: sport.available ? 1 : 0.6,
                  }}
                >
                  <span>{sport.emoji}</span>
                  <span>{sport.label}</span>
                  {sport.badge && (
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: '#3A3A52',
                        fontFamily: 'var(--font-sport)',
                      }}
                    >
                      {sport.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Sport content */}
          {sportTab === 'futbol' && <QuinielaClient />}
          {sportTab === 'ufc'    && <SportComingSoon sport="Ranked UFC" emoji="🥊" accent="#F87171" />}
          {sportTab === 'mundial' && <SportComingSoon sport="Ranked Mundial 2026" emoji="🏆" accent="#FBBF24" />}
        </>
      )}

      {hubTab === 'creadores' && <HubComingSoon title="Ligas de Creadores" description="Únete a la liga de tu creador favorito y compite con su comunidad. Patrocinadores, branding propio y rankings exclusivos." emoji="🎙️" />}
      {hubTab === 'privadas'  && <HubComingSoon title="Ligas Privadas" description="Crea una liga con hasta 15 amigos, elige el deporte y compite semana a semana. Un código, tu grupo, tu ranking." emoji="🔒" />}

      <NewsletterSection source="predicciones" />
      <Footer />
      <ScrollToTop />
    </div>
  )
}

// ── Placeholders ─────────────────────────────────────────────────────

function SportComingSoon({
  sport,
  emoji,
  accent,
}: {
  sport: string
  emoji: string
  accent: string
}) {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-24 flex flex-col items-center gap-4 text-center">
      <span style={{ fontSize: 56 }}>{emoji}</span>
      <h2
        className="font-black"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
          color: accent,
          letterSpacing: '-0.02em',
        }}
      >
        {sport}
      </h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: 380, fontSize: 14 }}>
        Predicciones por evento, ranking global y ligas privadas. Muy pronto.
      </p>
      <span
        className="mt-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest"
        style={{
          background: `${accent}12`,
          border: `1px solid ${accent}30`,
          color: accent,
          fontFamily: 'var(--font-sport)',
        }}
      >
        Próximamente
      </span>
    </div>
  )
}

function HubComingSoon({
  title,
  description,
  emoji,
}: {
  title: string
  description: string
  emoji: string
}) {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-24 flex flex-col items-center gap-4 text-center">
      <span style={{ fontSize: 56 }}>{emoji}</span>
      <h2
        className="font-black"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
          color: '#F0F0F8',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: 400, fontSize: 14, lineHeight: 1.6 }}>
        {description}
      </p>
      <span
        className="mt-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-sport)',
        }}
      >
        Próximamente
      </span>
    </div>
  )
}

// ── Loading shim (mientras carga QuinielaClient) ──────────────────────
function QuinielaLoadingShim() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-12 flex justify-center">
      <div
        className="w-8 h-8 rounded-full animate-spin"
        style={{ border: '2px solid rgba(255,255,255,0.08)', borderTopColor: 'var(--accent)' }}
      />
    </div>
  )
}
