'use client'

import { useState } from 'react'

// Hash determinista nombre → hue (0-360) para que cada deportista
// tenga siempre el mismo color de fallback.
function nameHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h % 360
}

// Iniciales: primera + primera de la siguiente palabra (máx 2)
function initialsOf(name: string): string {
  const clean = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase()
}

export default function PlayerAvatar({
  src, alt, fallback, size = 36, rounded = 'xl',
}: {
  src?: string; alt: string; fallback: string; size?: number; rounded?: string
}) {
  const [ok, setOk] = useState(true)

  if (ok && src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover rounded-${rounded}`}
        onError={() => setOk(false)}
      />
    )
  }

  // Fallback gradient con iniciales — todo deportista tiene avatar visual
  const hue = nameHue(alt)
  const initials = initialsOf(alt)
  const useEmoji = fallback && /\p{Emoji}/u.test(fallback) && fallback.length <= 4

  return (
    <span
      className="w-full h-full flex items-center justify-center select-none font-black"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 65% 28%) 0%, hsl(${(hue + 40) % 360} 55% 18%) 100%)`,
        color: `hsl(${hue} 80% 80%)`,
        fontSize: useEmoji ? size * 0.55 : size * 0.38,
        letterSpacing: '-0.02em',
        fontFamily: 'var(--font-display)',
      }}
    >
      {useEmoji ? fallback : initials}
    </span>
  )
}
