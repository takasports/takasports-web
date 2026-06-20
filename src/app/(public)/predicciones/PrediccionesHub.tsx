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

import { useState, Suspense, type KeyboardEvent } from 'react'
import dynamic from 'next/dynamic'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'
import TakaPoint from '@/components/TakaPoint'
import { useStreak } from '@/hooks/useGameState'
import { usePoints } from '@/hooks/useGameState'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard'
import PorraChallengeBanner from '@/components/PorraChallengeBanner'
import { RANKED_FUTBOL_ENABLED } from '@/lib/feature-flags'
import { RankedCategoryIcon, FireIcon } from '@/components/icons/GameIcons'

// Carga dinámica — solo se carga el cliente activo
const QuinielaClient = dynamic(
  () => import('@/app/quiniela/QuinielaClient'),
  { ssr: false, loading: () => <QuinielaLoadingShim /> }
)

const MundialClient = dynamic(
  () => import('@/app/(public)/mundial/MundialClient'),
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

// Tabs del hub (todas disponibles)
const HUB_TABS: { id: HubTab; label: string }[] = [
  { id: 'ranked',    label: 'Ranked' },
  { id: 'creadores', label: 'Ligas Creadores' },
  { id: 'privadas',  label: 'Ligas Privadas' },
]

// Mundial es la tab por defecto cuando está disponible

// ── Componente principal ─────────────────────────────────────────────
export default function PrediccionesHub() {
  const [hubTab,   setHubTab]   = useState<HubTab>('ranked')
  const [sportTab, setSportTab] = useState<SportTab>('mundial')
  const { streak }              = useStreak()
  const { points }              = usePoints()

  // Navegación por teclado del tablist del hub (WAI-ARIA): flechas/Home/End
  // ciclan entre las 3 secciones y trasladan el foco a la recién activada.
  function onHubKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    let next = -1
    if (e.key === 'ArrowRight') next = (idx + 1) % HUB_TABS.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + HUB_TABS.length) % HUB_TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = HUB_TABS.length - 1
    else return
    e.preventDefault()
    const t = HUB_TABS[next]
    setHubTab(t.id)
    if (typeof document !== 'undefined') document.getElementById(`hubtab-${t.id}`)?.focus()
  }

  // Selector de deporte: navegación SOLO entre deportes disponibles (salta
  // los marcados 'Pronto', igual que RankedLeaderboard).
  function onSportKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    const avail = SPORTS.map((s, i) => ({ s, i })).filter(x => x.s.available)
    const pos = avail.findIndex(x => x.i === idx)
    if (pos === -1) return
    let nextPos = -1
    if (e.key === 'ArrowRight') nextPos = (pos + 1) % avail.length
    else if (e.key === 'ArrowLeft') nextPos = (pos - 1 + avail.length) % avail.length
    else if (e.key === 'Home') nextPos = 0
    else if (e.key === 'End') nextPos = avail.length - 1
    else return
    e.preventDefault()
    const target = avail[nextPos].s
    setSportTab(target.id)
    if (typeof document !== 'undefined') document.getElementById(`sporttab-${target.id}`)?.focus()
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* U — Banner de reto, solo cuando ?reto=TOKEN llega en la URL.
          F6 — Suspense boundary: useSearchParams en client component lo
          requiere para no forzar a la ruta entera a dynamic rendering. */}
      {RANKED_FUTBOL_ENABLED && (
        <Suspense fallback={null}>
          <PorraChallengeBanner />
        </Suspense>
      )}

      {/* ── Hub tabs ──────────────────────────────────────────────── */}
      <div
        className="sticky top-[48px] z-30 border-b"
        style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10">
          <div className="flex gap-0 overflow-x-auto scrollbar-none" role="tablist" aria-label="Secciones de predicciones">
            {HUB_TABS.map((tab, idx) => {
              const on = hubTab === tab.id
              return (
                <button
                  key={tab.id}
                  id={`hubtab-${tab.id}`}
                  role="tab"
                  aria-selected={on}
                  aria-controls="hubpanel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setHubTab(tab.id)}
                  onKeyDown={e => onHubKeyDown(e, idx)}
                  className="relative flex-shrink-0 px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-inset"
                  style={{
                    color: on ? '#F0F0F8' : 'var(--text-muted)',
                    fontFamily: 'var(--font-sport)',
                    borderBottom: on
                      ? '2px solid var(--accent)'
                      : '2px solid transparent',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Contenido (tabpanel del hub) ──────────────────────────── */}
      <div role="tabpanel" id="hubpanel" aria-labelledby={`hubtab-${hubTab}`} tabIndex={0} className="focus-visible:outline-none">
      {hubTab === 'ranked' && (
        <div style={{ position: 'relative' }}>
          {/* Ambiente cinematográfico por deporte (fondos "La Señal", Higgsfield).
              Capa estática detrás del contenido; se desvanece hacia abajo;
              key={sportTab} → crossfade al cambiar de deporte. Respeta
              prefers-reduced-motion (globals: .signal-ambient → animation none). */}
          <div className="signal-ambient" aria-hidden="true" key={sportTab}>
            <img
              src={`/banners/signal/${sportTab}.webp`}
              alt=""
              className="signal-backdrop"
              loading="lazy"
              decoding="async"
            />
            <div className="signal-scrim" />
            <div
              className="signal-tint"
              style={{
                background: `radial-gradient(120% 80% at 50% 0%, ${
                  SPORTS.find(s => s.id === sportTab)?.accent ?? '#FBBF24'
                }26 0%, transparent 58%)`,
              }}
            />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Sport selector */}
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pt-4 pb-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-none" role="tablist" aria-label="Deporte">
              {SPORTS.map((sport, idx) => {
                const on = sportTab === sport.id && sport.available
                return (
                <button
                  key={sport.id}
                  id={`sporttab-${sport.id}`}
                  role="tab"
                  aria-selected={on}
                  aria-controls="sportpanel"
                  aria-disabled={!sport.available || undefined}
                  tabIndex={sportTab === sport.id ? 0 : -1}
                  onClick={() => sport.available && setSportTab(sport.id)}
                  onKeyDown={e => onSportKeyDown(e, idx)}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  style={{
                    background: on
                      ? `${sport.accent}18`
                      : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${
                      on
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
                  <span aria-hidden="true" className="inline-flex"><RankedCategoryIcon sport={sport.id} size={14} /></span>
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
                )
              })}
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
                    <span style={{ display: 'inline-flex', color: '#F97316' }}><FireIcon size={14} /></span>
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

          {/* Sport content (tabpanel del selector de deporte) */}
          <div role="tabpanel" id="sportpanel" aria-labelledby={`sporttab-${sportTab}`} tabIndex={0} className="focus-visible:outline-none">
          {/* Ranked Fútbol — actualmente "Pronto". Para reactivar: cambiar
              available:true en SPORTS arriba y dejar este render activo. */}
          {sportTab === 'futbol' && (
            SPORTS.find(s => s.id === 'futbol')?.available
              ? <QuinielaClient embedded />
              : <SportComingSoon sport="Ranked Fútbol" iconSport="futbol" accent="#4ADE80" />
          )}
          {sportTab === 'ufc'    && <UfcClient />}
          {sportTab === 'mundial' && <MundialClient />}
          <RankedLeaderboard activeSport={sportTab} />
          </div>
          </div>
        </div>
      )}

      {hubTab === 'creadores' && <CreadoresClient />}
      {hubTab === 'privadas'  && <PrivadasClient />}
      </div>

      <NewsletterSection source="predicciones" />
      <ScrollToTop />
    </div>
  )
}

// ── Placeholders ─────────────────────────────────────────────────────

function SportComingSoon({
  sport,
  iconSport,
  accent,
}: {
  sport: string
  iconSport: string
  accent: string
}) {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-24 flex flex-col items-center gap-4 text-center">
      <span style={{ display: 'inline-flex', color: accent }}><RankedCategoryIcon sport={iconSport} size={56} /></span>
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
