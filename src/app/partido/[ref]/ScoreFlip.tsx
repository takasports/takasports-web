'use client'

import { useEffect, useRef, useState } from 'react'

// Tamaños por contexto. 'hero' = marcador grande del TeamScoreboard; 'compact'
// = barra sticky que aparece al hacer scroll. gap replica los gap-3 / gap-1.5
// originales para no alterar el look ya aprobado.
const VARIANT = {
  hero:    { fontSize: 'clamp(38px, 9vw, 56px)', gap: '0.75rem'  },
  compact: { fontSize: 22,                        gap: '0.375rem' },
} as const

// Un lado del marcador con "flip" de dígito cuando el tanteo cambia en vivo.
// La ficha se re-renderiza cada ~20s vía router.refresh() (LiveRefresh): React
// CONSERVA esta instancia cliente entre refrescos, así que comparamos el valor
// anterior por ref y, si cambió, remontamos el dígito (key++) para re-disparar
// la animación CSS `tsScoreFlip`. En el primer montaje también corre = entrada.
function Side({ value, fontSize }: { value: number; fontSize: number | string }) {
  const prev = useRef(value)
  const [flipKey, setFlipKey] = useState(0)
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setFlipKey((k) => k + 1)
    }
  }, [value])
  return (
    <span key={flipKey} className="ts-score-flip" style={{ fontSize }}>
      {value}
    </span>
  )
}

// Marcador compartido por el héroe (TeamScoreboard) y la barra compacta sticky
// (StickyScoreBar) → un solo lenguaje visual + el mismo gesto de "flip" cuando
// cae un gol/canasta en directo. Respeta prefers-reduced-motion vía CSS.
export function ScoreFlip({
  home,
  away,
  variant,
}: {
  home: number
  away: number
  variant: 'hero' | 'compact'
}) {
  const v = VARIANT[variant]
  return (
    <span
      className="font-black tabular-nums inline-flex items-center leading-none"
      style={{ color: '#F0F0FA', fontFamily: 'var(--font-headline)', gap: v.gap }}
    >
      <Side value={home} fontSize={v.fontSize} />
      <span aria-hidden="true" style={{ color: '#38384A', fontWeight: 400, fontSize: v.fontSize }}>·</span>
      <Side value={away} fontSize={v.fontSize} />
    </span>
  )
}
