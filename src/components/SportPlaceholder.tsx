import { getSportStyle, getSportEmoji, getSportLabel } from '@/lib/sports'

interface Props {
  sport?: string
  category?: string
  className?: string
  style?: React.CSSProperties
  emojiSize?: number
}

export default function SportPlaceholder({ sport, category, className, style, emojiSize = 32 }: Props) {
  const { bg, accent } = getSportStyle(sport, category)
  const label = getSportLabel(sport, category)
  const emoji = getSportEmoji(label)

  return (
    <div
      className={`w-full h-full flex items-center justify-center relative overflow-hidden ${className ?? ''}`}
      style={{ background: bg, ...style }}
    >
      {/* Subtle glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 80% at 50% 50%, ${accent}14 0%, transparent 70%)`,
        }}
      />
      <span
        aria-hidden
        style={{ fontSize: emojiSize, lineHeight: 1, position: 'relative', opacity: 0.55 }}
      >
        {emoji}
      </span>
    </div>
  )
}
