'use client'

// ─────────────────────────────────────────────────────────────────
// BadgeUnlockModal — modal celebratorio que aparece cuando el user
// desbloquea un badge nuevo. Se monta desde BadgeUnlockProvider.
//
// Diseño:
//   · Overlay full-screen con fade-in
//   · Halo radial del color del badge
//   · Confeti CSS (12 partículas absolutas con keyframes) — solo si
//     el user no tiene `prefers-reduced-motion`
//   · Título "¡Desbloqueado!" con rareza + nombre del badge
//   · Descripción del badge + título que desbloquea (si aplica)
//   · Botón "Ver mis badges" → /badges
//   · Botón "Siguiente" si hay cola
//   · Click fuera o ESC cierra
//
// Accesibilidad: role="dialog", aria-modal, focus trap básico al primer
// botón, ESC cierra, animaciones respetan reduced-motion.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { BadgeIcon, hasBadgeIcon } from '@/components/icons/badges/BadgeIcon'

export interface UnlockedBadgeView {
  id:          string
  name:        string
  emoji:       string
  color:       string
  bg:          string
  rarity:      'common' | 'rare' | 'epic' | 'legendary' | string
  description: string
  /** Título equipable que este badge desbloquea (si aplica). */
  titleUnlock?: string | null
}

const RARITY_LABEL: Record<string, string> = {
  common: 'Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario',
}

const RARITY_TAGLINE: Record<string, string> = {
  common:    'Un paso más en el viaje',
  rare:      'Logro destacado',
  epic:      '¡Logro épico!',
  legendary: '¡LEGENDARIO!',
}

// Confeti — partículas con offset/ángulo distintos para que se vean naturales.
const CONFETTI = Array.from({ length: 14 }, (_, i) => ({
  left: `${5 + (i * 7) % 90}%`,
  delay: `${(i % 5) * 0.08}s`,
  duration: `${1.6 + (i % 4) * 0.25}s`,
  rotate: `${(i * 47) % 360}deg`,
}))

interface Props {
  badge: UnlockedBadgeView
  queueRemaining: number    // cuántos más vienen detrás
  onNext: () => void
  onClose: () => void
}

export function BadgeUnlockModal({ badge, queueRemaining, onNext, onClose }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const isLegendary = badge.rarity === 'legendary'
  const isEpicPlus  = isLegendary || badge.rarity === 'epic'

  // ESC cierra; focus al botón primario al montar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    closeBtnRef.current?.focus()
    // Bloquear scroll del body mientras está abierto
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Badge desbloqueado: ${badge.name}`}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 badge-unlock-overlay"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 badge-unlock-backdrop" style={{ background: 'rgba(6,6,14,0.78)' }} />

      {/* Halo */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none badge-unlock-halo"
        style={{
          width: 520, height: 520, borderRadius: '50%',
          background: `radial-gradient(circle, ${badge.color}38 0%, ${badge.color}10 35%, transparent 70%)`,
          filter: 'blur(20px)',
        }}
      />

      {/* Confeti — solo si no hay reduced-motion */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden badge-unlock-confetti">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-20px',
              left: c.left,
              width: 8,
              height: 14,
              background: i % 3 === 0 ? badge.color : i % 3 === 1 ? '#fbbf24' : '#a78bfa',
              borderRadius: 2,
              transform: `rotate(${c.rotate})`,
              animation: `badgeConfettiFall ${c.duration} ease-in ${c.delay} forwards`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className="relative rounded-3xl px-7 py-8 max-w-[420px] w-full text-center badge-unlock-card"
        onClick={e => e.stopPropagation()}
        style={{
          background: isLegendary
            ? `linear-gradient(160deg, ${badge.color}22 0%, rgba(15,8,30,0.95) 50%, ${badge.color}12 100%)`
            : `linear-gradient(160deg, ${badge.color}1A 0%, rgba(15,8,30,0.92) 80%)`,
          border: `1px solid ${badge.color}55`,
          boxShadow: `0 30px 90px ${badge.color}30, 0 0 0 1px ${badge.color}25 inset`,
        }}
      >
        {/* Rarity tagline */}
        <p
          className="text-[10px] font-black uppercase tracking-[0.22em] mb-4"
          style={{ color: badge.color, fontFamily: 'var(--font-sport)', opacity: 0.85 }}
        >
          {RARITY_TAGLINE[badge.rarity] ?? 'Badge desbloqueado'}
        </p>

        {/* Icon big — custom SVG si existe, emoji fallback */}
        <div
          className="mx-auto flex items-center justify-center rounded-full mb-5 badge-unlock-emoji"
          style={{
            width: 110, height: 110,
            background: badge.bg,
            border: `2px solid ${badge.color}80`,
            boxShadow: `0 0 40px ${badge.color}55, inset 0 0 30px ${badge.color}22`,
            fontSize: 58, lineHeight: 1,
            color: badge.color,
          }}
        >
          {hasBadgeIcon(badge.id)
            ? <BadgeIcon id={badge.id} size={56} strokeWidth={2} />
            : badge.emoji}
        </div>

        {/* Name + rarity pill */}
        <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
          <h2
            className="text-2xl font-black"
            style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
          >
            {badge.name}
          </h2>
          <span
            className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest"
            style={{
              background: `${badge.color}22`,
              color: badge.color,
              border: `1px solid ${badge.color}55`,
              fontFamily: 'var(--font-sport)',
            }}
          >
            {RARITY_LABEL[badge.rarity] ?? badge.rarity}
          </span>
        </div>

        {/* Description */}
        <p
          className="text-[12px] leading-relaxed mb-3"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
        >
          {badge.description}
        </p>

        {/* Title unlock — un detalle muy gratificante para epic+ */}
        {badge.titleUnlock && (
          <p
            className="text-[11px] mb-5 font-black"
            style={{ color: badge.color, fontFamily: 'var(--font-sport)', opacity: 0.9 }}
          >
            Desbloqueas el título: &ldquo;{badge.titleUnlock}&rdquo;
          </p>
        )}
        {!badge.titleUnlock && <div style={{ height: 12 }} />}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {queueRemaining > 0 ? (
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onNext}
              className="w-full px-4 py-2.5 rounded-xl text-[12px] font-black transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2"
              style={{
                background: badge.color,
                color: isEpicPlus ? '#0A0612' : '#0A0612',
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.04em',
              }}
            >
              Siguiente badge ({queueRemaining + 1} en total) →
            </button>
          ) : (
            <Link
              href="/badges"
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-xl text-[12px] font-black transition-opacity hover:opacity-90 text-center"
              style={{
                background: badge.color,
                color: '#0A0612',
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.04em',
                textDecoration: 'none',
              }}
            >
              Ver mis badges →
            </Link>
          )}
          <button
            ref={queueRemaining === 0 ? closeBtnRef : null}
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 rounded-xl text-[11px] font-semibold transition-opacity hover:opacity-100"
            style={{
              background: 'transparent',
              color: '#7A7A92',
              border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'var(--font-sport)',
              opacity: 0.7,
            }}
          >
            {queueRemaining > 0 ? 'Cerrar todos' : 'Cerrar'}
          </button>
        </div>
      </div>

      {/* Animations — scoped via class names */}
      <style jsx>{`
        .badge-unlock-overlay {
          animation: badgeOverlayIn 0.18s ease-out;
        }
        .badge-unlock-halo {
          animation: badgeHaloPulse 2.4s ease-in-out infinite;
        }
        .badge-unlock-card {
          animation: badgeCardIn 0.34s cubic-bezier(0.2, 0.9, 0.3, 1.15);
        }
        .badge-unlock-emoji {
          animation: badgeEmojiPop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.4);
        }
        @keyframes badgeOverlayIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes badgeCardIn {
          0%   { opacity: 0; transform: scale(0.85) translateY(20px) }
          100% { opacity: 1; transform: scale(1) translateY(0) }
        }
        @keyframes badgeEmojiPop {
          0%   { transform: scale(0.2) rotate(-20deg); opacity: 0 }
          60%  { transform: scale(1.2) rotate(8deg); opacity: 1 }
          100% { transform: scale(1) rotate(0); opacity: 1 }
        }
        @keyframes badgeHaloPulse {
          0%, 100% { transform: scale(1); opacity: 0.9 }
          50%      { transform: scale(1.08); opacity: 1 }
        }
        @media (prefers-reduced-motion: reduce) {
          .badge-unlock-overlay, .badge-unlock-card, .badge-unlock-emoji, .badge-unlock-halo {
            animation: none !important;
          }
          .badge-unlock-confetti { display: none }
        }
      `}</style>
      <style jsx global>{`
        @keyframes badgeConfettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1 }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0 }
        }
        @media (prefers-reduced-motion: reduce) {
          .badge-unlock-confetti { display: none }
        }
      `}</style>
    </div>
  )
}
