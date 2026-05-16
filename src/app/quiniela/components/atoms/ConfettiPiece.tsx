'use client'

const CONFETTI_COLORS = ['#7C3AED','#A78BFA','#fbbf24','#4ade80','#f87171','#60a5fa','#f472b6']

export function ConfettiPiece({ i }: { i: number }) {
  const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
  const left = ((i * 37 + 13) % 100)
  const delay = ((i * 7) % 18) * 0.1
  const size = 6 + (i % 5) * 2
  return (
    <div style={{
      position: 'fixed', top: 0, left: `${left}%`, zIndex: 51,
      width: size, height: size, borderRadius: i % 3 === 0 ? '50%' : 2,
      background: color,
      animation: `confettiFall ${1.4 + (i % 6) * 0.15}s ease-in both`,
      animationDelay: `${delay}s`,
      pointerEvents: 'none',
    }} />
  )
}
