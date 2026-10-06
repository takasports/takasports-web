// Acceso de una previa a la ficha de su partido (/partido/[ref]): alineaciones,
// estadísticas y marcador en directo. Solo lo llevan las notas con `matchRef`
// (las previas automáticas), así que el enlace es exacto, no adivinado.
//
// prefetch={false} a propósito: el prefetch de enlaces a páginas pesadas ya tumbó
// el sitio dos veces (ver /comparar). Una ficha de partido es de las más caras.
//
// Diseño: casilla de navegación (`.cas-link`, globals.css). Si va seguida del enlace
// a la previa, las dos se leen como una sola lista.

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { accentTexto } from '@/lib/sports'

export default function FichaPartidoLink({
  matchRef,
  home,
  away,
  accent = '#7c3aed',
}: {
  matchRef: string
  home?: string | null
  away?: string | null
  accent?: string
}) {
  const partido = home && away ? `${home} – ${away}` : 'Ficha del partido'
  return (
    <Link
      href={`/partido/${encodeURIComponent(matchRef)}`}
      prefetch={false}
      className="ts-ficha-link cas-link"
      style={{ '--acc': accent, '--acc-text': accentTexto(accent) } as CSSProperties}
    >
      <span aria-hidden className="cas-link__icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M12 5v14M3 9h3v6H3M21 9h-3v6h3" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      </span>
      <span className="cas-link__body">
        <span className="cas-link__kicker">Ficha del partido</span>
        <span className="cas-link__title">{partido}</span>
        <span className="cas-link__sub">Alineaciones, estadísticas y marcador en directo</span>
      </span>
      <span aria-hidden className="cas-link__arrow">→</span>
    </Link>
  )
}
