'use client'

import { useState } from 'react'
import { getClubColors } from '@/lib/clubs'

// ─────────────────────────────────────────────────────────────────
// Jersey SVG — camiseta minimalista bicolor
// ─────────────────────────────────────────────────────────────────
export function JerseyIcon({ name, size = 32 }: { name: string; size?: number }) {
  const { primary, secondary } = getClubColors(name)
  const id = `j-${name.replace(/\s/g, '-').toLowerCase()}`
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={`clip-${id}`}>
          <path d="M10 4 L6 10 L2 8 L2 16 L6 16 L6 28 L26 28 L26 16 L30 16 L30 8 L26 10 L22 4 C20 6 18 7 16 7 C14 7 12 6 10 4Z" />
        </clipPath>
      </defs>
      {/* Mitad izquierda — color primario */}
      <rect x="0" y="0" width="16" height="32" fill={primary} clipPath={`url(#clip-${id})`} />
      {/* Mitad derecha — color secundario */}
      <rect x="16" y="0" width="16" height="32" fill={secondary} clipPath={`url(#clip-${id})`} />
      {/* Silueta de camiseta */}
      <path
        d="M10 4 L6 10 L2 8 L2 16 L6 16 L6 28 L26 28 L26 16 L30 16 L30 8 L26 10 L22 4 C20 6 18 7 16 7 C14 7 12 6 10 4Z"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────
// Shield SVG — escudo de equipo con colores reales
// ─────────────────────────────────────────────────────────────────
export function ShieldIcon({ name, size = 44 }: { name: string; size?: number }) {
  const { primary, secondary } = getClubColors(name)
  const initials = name.replace(/^(FC |CD |RC |Real |Atlético |Club |Athletic |Sporting |Deportivo )/i, '').slice(0, 2).toUpperCase()
  const id = `sh-${name.replace(/\s/g, '-').toLowerCase()}`
  const h = Math.round(size * 1.12)
  return (
    <svg width={size} height={h} viewBox="0 0 40 45" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
        <clipPath id={`sc-${id}`}>
          <path d="M20 2L37 9V25C37 35 20 43 20 43C20 43 3 35 3 25V9L20 2Z" />
        </clipPath>
      </defs>
      <path d="M20 2L37 9V25C37 35 20 43 20 43C20 43 3 35 3 25V9L20 2Z" fill={`url(#sg-${id})`} />
      <path d="M20 2V43C20 43 3 35 3 25V9L20 2Z" fill={secondary} opacity="0.4" />
      <line x1="20" y1="2" x2="20" y2="43" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
      <path d="M3 16H37" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
      <path d="M20 2L37 9V25C37 35 20 43 20 43C20 43 3 35 3 25V9L20 2Z" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" fill="none" />
      <text x="20" y="27" textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="900" fill="rgba(255,255,255,0.92)" fontFamily="system-ui,sans-serif" letterSpacing="-0.5">{initials}</text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────
// TeamBadge — logo real ESPN si disponible, escudo SVG si no
// ─────────────────────────────────────────────────────────────────
export function TeamBadge({ name, logo, size = 44 }: { name: string; logo?: string; size?: number }) {
  const [imgError, setImgError] = useState(false)
  if (logo && !imgError) {
    const pad = Math.round(size * 0.08)
    return (
      <div style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.22),
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt={name}
          width={size - pad * 2}
          height={size - pad * 2}
          style={{ objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
          onError={() => setImgError(true)}
        />
      </div>
    )
  }
  return <ShieldIcon name={name} size={size} />
}
