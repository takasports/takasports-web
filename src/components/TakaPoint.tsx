// TakaPoint — icono oficial del sistema de puntos de TakaSports.
// Un rayo geométrico angular con identidad propia: más corto, más ancho
// y con un corte diagonal en la base que lo diferencia del rayo genérico.
// Se usa en toda la UI donde aparezcan puntos: badges, leaderboards, perfil.
//
// Uso:
//   <TakaPoint size={16} />           → tamaño pequeño (badges, inline)
//   <TakaPoint size={24} />           → tamaño medio (cards)
//   <TakaPoint size={40} />           → tamaño grande (perfil, leaderboard)
//   <TakaPoint size={16} muted />     → versión apagada (texto secundario)

interface TakaPointProps {
  size?: number
  muted?: boolean
  className?: string
}

export default function TakaPoint({ size = 16, muted = false, className }: TakaPointProps) {
  const id = `tp-grad-${size}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="puntos Taka"
      role="img"
    >
      <defs>
        <linearGradient id={id} x1="6" y1="2" x2="14" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={muted ? '#4A4A6A' : '#A78BFA'} />
          <stop offset="100%" stopColor={muted ? '#2A2A42' : '#6D28D9'} />
        </linearGradient>
      </defs>
      {/*
        Forma: hexágono irregular tipo escudo deportivo con un rayo interior.
        El path describe un pentágono apuntado arriba + corte diagonal abajo.
        No es un rayo genérico — es una forma propia que sugiere velocidad
        y competición sin ser literal.
      */}
      <path
        d="M13.5 2L5 13.5H11L9 22L19 10H13L15.5 2Z"
        fill={`url(#${id})`}
      />
      {/* Highlight interior — da volumen y carácter de icono de app */}
      <path
        d="M13 4.5L7.5 13H12L10.5 19L17 10.5H12.5L14.5 4.5Z"
        fill={muted ? 'rgba(74,74,106,0.4)' : 'rgba(167,139,250,0.25)'}
      />
    </svg>
  )
}

// ── Versiones nombradas para uso semántico ────────────────────────────

/** Badge inline: número + icono. Ej: "+3 ⚡" */
export function TakaPointBadge({
  value,
  size = 13,
  className,
}: {
  value: number | string
  size?: number
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-black tabular-nums ${className ?? ''}`}
      style={{
        fontFamily: 'var(--font-sport)',
        fontSize: size,
        color: '#A78BFA',
        letterSpacing: '-0.01em',
      }}
    >
      <TakaPoint size={size + 1} />
      {value}
    </span>
  )
}
