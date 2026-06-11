/*
 * Barra divergente "tira y afloja" reutilizable (0 KB).
 * Dos lados que tiran desde el centro: cada uno proporcional al mayor de los
 * dos (magnitud real del dato), el ganador en color pleno + número blanco, el
 * perdedor atenuado. El "ganador" lo decide quien la usa (puede invertirse para
 * métricas donde menos = mejor); en esos casos pasa `note="menos = mejor"`.
 * Reusa el keyframe .ts-bar-fill de globals (respeta prefers-reduced-motion).
 */
export default function DivergentBar({
  label,
  displayA,
  displayB,
  magA,
  magB,
  max,
  aWins,
  bWins,
  accent,
  note,
  last,
}: {
  label: string
  displayA: string
  displayB: string
  magA: number
  magB: number
  max: number
  aWins: boolean
  bWins: boolean
  accent: string
  note?: string
  last?: boolean
}) {
  const safeMax = max > 0 ? max : 1
  const pctA = Math.round((Math.max(magA, 0) / safeMax) * 100)
  const pctB = Math.round((Math.max(magB, 0) / safeMax) * 100)
  return (
    <div
      className="flex items-center text-[13px]"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Lado A (tira a la izquierda) */}
      <div className="flex-1 flex items-center gap-2 pl-3 pr-1.5 py-2.5 min-w-0">
        <span className="tabular-nums font-bold w-10 text-right flex-shrink-0"
          style={{ color: aWins ? '#fff' : '#8A8AA0' }}>{displayA}</span>
        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full ts-bar-fill ml-auto"
            style={{ width: `${pctA}%`, background: accent, opacity: aWins ? 1 : 0.4 }} />
        </div>
      </div>
      {/* Etiqueta central */}
      <div className="w-20 text-center flex-shrink-0 px-0.5">
        <div className="text-[9.5px] uppercase tracking-wide leading-tight"
          style={{ color: '#7C7C8C', fontFamily: 'var(--font-sport)' }}>{label}</div>
        {note && (
          <div className="text-[8px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{note}</div>
        )}
      </div>
      {/* Lado B (tira a la derecha) */}
      <div className="flex-1 flex items-center gap-2 pr-3 pl-1.5 py-2.5 min-w-0">
        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full ts-bar-fill"
            style={{ width: `${pctB}%`, background: accent, opacity: bWins ? 1 : 0.4 }} />
        </div>
        <span className="tabular-nums font-bold w-10 flex-shrink-0"
          style={{ color: bWins ? '#fff' : '#8A8AA0' }}>{displayB}</span>
      </div>
    </div>
  )
}
