'use client'

// Onboarding modal reutilizable para juegos: aparece en primer ingreso,
// guía en N pasos cortos, y nunca vuelve a salir (clave en localStorage).
// El usuario puede saltarlo con la X (también persiste).

import { useEffect, useState } from 'react'

export interface OnboardingStep {
  emoji: string
  title: string
  body: string
}

interface Props {
  storageKey: string         // Identificador único por juego (ej: 'ts-onboarded-mionce')
  steps: OnboardingStep[]
  accent: string
  ctaFinal?: string          // Texto del último botón. Default: '¡A jugar!'
}

export default function GameOnboarding({ storageKey, steps, accent, ctaFinal = '¡A jugar!' }: Props) {
  const [state, setState] = useState<'pending' | 'show' | 'hide'>('pending')
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    try {
      const done = window.localStorage.getItem(storageKey)
      setState(done ? 'hide' : 'show')
    } catch {
      setState('hide')
    }
  }, [storageKey])

  if (state !== 'show' || steps.length === 0) return null

  const finish = () => {
    try { window.localStorage.setItem(storageKey, new Date().toISOString()) } catch { /* ignore */ }
    setState('hide')
  }

  const step = steps[Math.min(idx, steps.length - 1)]
  const isLast = idx >= steps.length - 1

  return (
    <div
      role="dialog"
      aria-labelledby="ts-onboarding-title"
      aria-modal="true"
      className="fixed inset-0 z-[55] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-card)',
          border: `1px solid ${accent}40`,
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* Header con dots de progreso */}
        <div className="flex items-center justify-between" style={{ padding: 'var(--space-md) var(--space-md) var(--space-xs)' }}>
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                style={{
                  height: 5,
                  borderRadius: 3,
                  width: i === idx ? 22 : 8,
                  background: i <= idx ? accent : 'rgba(255,255,255,0.1)',
                  transition: 'all var(--duration-base) var(--ease-standard)',
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={finish}
            aria-label="Saltar tutorial"
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-sport)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Saltar
          </button>
        </div>

        {/* Step content */}
        <div className="flex flex-col items-center text-center" style={{ padding: 'var(--space-md) var(--space-lg) var(--space-lg)' }}>
          <span aria-hidden="true" style={{ fontSize: 56, lineHeight: 1, marginBottom: 'var(--space-md)' }}>
            {step.emoji}
          </span>
          <h2
            id="ts-onboarding-title"
            className="font-black"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              color: '#F8F8FF',
              letterSpacing: '-0.02em',
              marginBottom: 8,
              lineHeight: 1.15,
            }}
          >
            {step.title}
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {step.body}
          </p>
        </div>

        {/* CTA */}
        <div style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>
          <button
            type="button"
            onClick={() => isLast ? finish() : setIdx(i => i + 1)}
            className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
            style={{
              padding: '14px',
              background: accent,
              color: '#0A0A12',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-sport)',
              fontWeight: 900,
              fontSize: 13,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'filter var(--duration-fast) var(--ease-standard)',
            }}
          >
            {isLast ? ctaFinal : `Siguiente · ${idx + 2}/${steps.length}`}
          </button>
        </div>
      </div>
    </div>
  )
}
