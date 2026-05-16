'use client'

import { useState, useEffect } from 'react'
import { ONBOARDING_STEPS } from '../../lib/constants'

// ─────────────────────────────────────────────────────────────────
// Onboarding bottom-sheet (4 pasos swipeable + skippable)
// ─────────────────────────────────────────────────────────────────
export function OnboardingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!open) return
    setStep(0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setStep(s => Math.min(s + 1, ONBOARDING_STEPS.length - 1))
      if (e.key === 'ArrowLeft') setStep(s => Math.max(s - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  const isLast = step === ONBOARDING_STEPS.length - 1
  const s = ONBOARDING_STEPS[step]
  return (
    <div role="dialog" aria-modal="true" aria-label="Cómo jugar a la Quiniela" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" style={{ background: 'rgba(3,0,9,0.85)', backdropFilter: 'blur(12px)', animation: 'fadeIn 0.2s ease both' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 relative" style={{ background: 'linear-gradient(160deg,#13002A 0%,#08000F 100%)', border: '1px solid rgba(124,58,237,0.3)', boxShadow: '0 -24px 60px rgba(0,0,0,0.6)', animation: 'sealPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <button aria-label="Cerrar" onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: '#9090B0', border: 'none', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <div className="flex items-center gap-1.5 mb-5">
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} aria-current={i === step} style={{ width: i === step ? 24 : 6, height: 4, borderRadius: 2, background: i <= step ? '#7C3AED' : 'rgba(255,255,255,0.1)', transition: 'width 0.25s, background 0.25s' }} />
          ))}
        </div>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>{s.emoji}</div>
        <h2 className="font-black mb-3" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem,4.4vw,2rem)', color: '#F8F8FF', letterSpacing: '-0.02em', lineHeight: 1.05 }}>{s.title}</h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: '#B8B0D0', fontFamily: 'var(--font-sport)' }}>{s.body}</p>
        {s.hint && (
          <div className="rounded-xl px-3 py-2.5 flex items-start gap-2 mb-5" style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)' }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>💡</span>
            <p className="text-[11px] leading-snug" style={{ color: '#9080C0', fontFamily: 'var(--font-sport)' }}>{s.hint}</p>
          </div>
        )}
        <div className="flex items-center gap-3 mt-2">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest" style={{ background: 'rgba(255,255,255,0.05)', color: '#9090B0', border: '1px solid rgba(255,255,255,0.06)', minHeight: 48, fontFamily: 'var(--font-sport)', cursor: 'pointer' }}>
              ←
            </button>
          )}
          <button
            onClick={() => { if (isLast) onClose(); else setStep(s => s + 1) }}
            className="flex-1 rounded-xl text-xs font-black uppercase tracking-widest transition-opacity hover:opacity-90"
            style={{ minHeight: 48, background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', border: '1px solid rgba(124,58,237,0.5)', fontFamily: 'var(--font-sport)', letterSpacing: '0.1em', boxShadow: '0 6px 22px rgba(124,58,237,0.35)', cursor: 'pointer' }}
          >
            {isLast ? '¡A jugar! 🎯' : `Siguiente · ${step + 2}/${ONBOARDING_STEPS.length}`}
          </button>
        </div>
        {!isLast && (
          <button onClick={onClose} className="w-full mt-3 text-[10px] font-black uppercase tracking-widest" style={{ color: '#4A4A6A', background: 'none', border: 'none', fontFamily: 'var(--font-sport)', cursor: 'pointer', minHeight: 36 }}>
            Saltar tutorial
          </button>
        )}
      </div>
    </div>
  )
}
