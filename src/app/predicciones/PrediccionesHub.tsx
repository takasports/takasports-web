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

import { useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'
import TakaPoint from '@/components/TakaPoint'
import { useStreak } from '@/hooks/useGameState'
import { usePoints } from '@/hooks/useGameState'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard'
import PorraChallengeBanner from '@/components/PorraChallengeBanner'
import { RANKED_FUTBOL_ENABLED } from '@/lib/feature-flags'

// Carga dinámica — solo se carga el cliente activo
const QuinielaClient = dynamic(
  () => import('@/app/quiniela/QuinielaClient'),
  { ssr: false, loading: () => <QuinielaLoadingShim /> }
)

const MundialClient = dynamic(
  () => import('@/app/mundial/MundialClient'),
  { ssr: false, loading: () => <QuinielaLoadingShim /> }
)

const UfcClient = dynamic(
  () => import('@/app/ufc/UfcClient'),
  { ssr: false, loading: () => <QuinielaLoadingShim /> }
)

const PrivadasClient = dynamic(
  () => import('./PrivadasClient'),
  { ssr: false, loading: () => <QuinielaLoadingShim /> }
)

const CreadoresClient = dynamic(
  () => import('./CreadoresClient'),
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
    available: true,
  },
  {
    // Sistema completo armado (QuinielaClient + APIs + DB). Para reactivar:
    // poner RANKED_FUTBOL_ENABLED=true en src/lib/feature-flags.ts.
    id:        'futbol',
    label:     'Ranked Fútbol',
    emoji:     '⚽',
    accent:    '#4ADE80',
    available: RANKED_FUTBOL_ENABLED,
    badge:     RANKED_FUTBOL_ENABLED ? undefined : 'Pronto',
  },
  {
    id:        'ufc',
    label:     'Ranked UFC',
    emoji:     '🥊',
    accent:    '#F87171',
    available: true,
  },
]

// Mundial es la tab por defecto cuando está disponible

// ── Componente principal ─────────────────────────────────────────────
export default function PrediccionesHub() {
  const [hubTab,   setHubTab]   = useState<HubTab>('ranked')
  const [sportTab, setSportTab] = useState<SportTab>('mundial')
  const { streak }              = useStreak()
  const { points }              = usePoints()

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />
      {/* U — Banner de reto, solo cuando ?reto=TOKEN llega en la URL.
          F6 — Suspense boundary: useSearchParams en client component lo
          requiere para no forzar a la ruta entera a dynamic rendering. */}
      <Suspense fallback={null}>
        <PorraChallengeBanner />
      </Suspense>

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

          {/* Stats strip — racha + puntos (solo si hay sesión) */}
          {(streak !== null || points !== null) && (
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-1">
              <div
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Racha Taka */}
                {streak !== null && (
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: 14 }}>🔥</span>
                    <span
                      className="text-[11px] font-black"
                      style={{ fontFamily: 'var(--font-sport)', color: '#F97316' }}
                    >
                      {streak.current_streak}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
                    >
                      {streak.current_streak === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                )}
                {streak !== null && points !== null && (
                  <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10 }}>·</span>
                )}
                {/* Puntos Taka */}
                {points !== null && (
                  <div className="flex items-center gap-1.5">
                    <TakaPoint size={14} />
                    <span
                      className="text-[11px] font-black"
                      style={{ fontFamily: 'var(--font-sport)', color: '#A78BFA' }}
                    >
                      {points.toLocaleString('es-ES')}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
                    >
                      pts
                    </span>
                  </div>
                )}
                {/* Spacer */}
                <div className="flex-1" />
                {/* Milestone hint si racha cerca de un hito */}
                {streak !== null && (() => {
                  const next = [3, 7, 14, 30].find(m => m > streak.current_streak)
                  if (!next) return null
                  const diff = next - streak.current_streak
                  if (diff > 3) return null
                  return (
                    <span
                      className="text-[10px] font-black"
                      style={{
                        fontFamily: 'var(--font-sport)',
                        color: '#F97316',
                        opacity: 0.7,
                      }}
                    >
                      {diff === 1 ? '¡Mañana bonus!' : `${diff} días para bonus`}
                    </span>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Sport content */}
          {/* Ranked Fútbol — actualmente "Pronto". Para reactivar: cambiar
              available:true en SPORTS arriba y dejar este render activo. */}
          {sportTab === 'futbol' && (
            SPORTS.find(s => s.id === 'futbol')?.available
              ? <QuinielaClient embedded />
              : <SportComingSoon sport="Ranked Fútbol" emoji="⚽" accent="#4ADE80" />
          )}
          {sportTab === 'ufc'    && <UfcClient />}
          {sportTab === 'mundial' && <MundialClient />}
          <RankedLeaderboard activeSport={sportTab} />
        </>
      )}

      {hubTab === 'creadores' && <CreadoresClient />}
      {hubTab === 'privadas'  && <PrivadasClient />}

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
