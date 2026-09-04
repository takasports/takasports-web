// ─────────────────────────────────────────────────────────────────────────────
// EmptyState — el hueco vacío, con salida.
//
// Había CUATRO implementaciones (ficha de partido, perfil, «Mis onces», álbum) y
// la que más se ve —la de la ficha de partido, en cada partido por jugar— no
// ofrecía NINGUNA salida: cero botones, cero enlaces. El siguiente movimiento del
// lector era el botón «atrás» del navegador.
//
// Un vacío honesto dice qué falta y, cuando existe, adónde ir mientras tanto.
// Cuando no hay nada que ofrecer —«sin enfrentamientos previos»— se queda sin
// acción a propósito: inventarse un botón es peor que no tenerlo.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react'

export default function EmptyState({
  message,
  icon,
  action,
  className = '',
}: {
  message: ReactNode
  icon?: ReactNode
  /** Qué puede hacer el lector mientras tanto. Opcional a propósito. */
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`text-center rounded-xl flex flex-col items-center gap-3 ${action ? 'py-9' : 'py-12'} ${className}`}
      style={{
        background: action ? 'rgba(124,58,237,0.05)' : 'rgba(255,255,255,0.02)',
        border: action ? '1px solid rgba(124,58,237,0.22)' : '1px dashed rgba(255,255,255,0.07)',
      }}
    >
      {icon ? <span aria-hidden style={{ color: action ? '#6D5B9E' : '#3A3A48' }}>{icon}</span> : null}
      <p
        className="text-[12.5px] font-semibold max-w-xs leading-relaxed"
        style={{ color: action ? 'var(--body-text)' : '#4A4A5A', fontFamily: 'var(--font-sport)' }}
      >
        {message}
      </p>
      {action ? <div className="flex items-center gap-2 flex-wrap justify-center">{action}</div> : null}
    </div>
  )
}
