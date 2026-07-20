import { getSportStyle, getSportLabel } from '@/lib/sports'
import { SportIcon } from '@/components/icons/GameIcons'

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
        style={{ lineHeight: 0, position: 'relative', opacity: 0.5, color: accent }}
      >
        <SportIcon sport={label} size={emojiSize} />
      </span>
    </div>
  )
}
