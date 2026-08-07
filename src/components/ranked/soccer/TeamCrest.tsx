'use client'

import { useState } from 'react'
import DynamicImage from '@/components/DynamicImage'

// ─────────────────────────────────────────────────────────────────────────────
// Escudo de equipo.
//
// El Mundial pintaba banderas con un diccionario de emojis nación→🇦🇷, que en
// clubes no sirve. ESPN da logo para clubes Y para selecciones (la bandera como
// imagen), así que aquí se usa siempre `meta.home_logo`/`away_logo` y se cae a
// las iniciales del equipo cuando falta — sin diccionarios que mantener.
// ─────────────────────────────────────────────────────────────────────────────

export default function TeamCrest({
  name, logo, abbr, size = 40,
}: {
  name: string | null
  logo?: string | null
  abbr?: string | null
  size?: number
}) {
  const [failed, setFailed] = useState(false)

  if (logo && !failed) {
    return (
      <DynamicImage
        src={logo}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    )
  }

  // Respaldo: abreviatura de ESPN o las dos primeras letras del nombre.
  const initials = (abbr || name || '?').slice(0, 3).toUpperCase()
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        fontFamily: 'var(--font-display)',
        fontSize: Math.round(size * 0.32), fontWeight: 900,
        color: 'rgba(255,255,255,0.55)', letterSpacing: '-0.02em',
      }}
    >
      {initials}
    </span>
  )
}
