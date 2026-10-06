// Previa ↔ crónica del mismo partido (06/10/2026). Mucha gente llega desde Google a la
// previa cuando el partido ya ha terminado: arriba de la previa, «Ya terminó · 2-1 · lee
// la crónica». Y la crónica enlaza a su previa. El cruce es por `matchRef` exacto, nunca
// por texto, y Google ve las dos notas unidas.
//
// prefetch={false}, como el resto de enlaces de la nota a páginas pesadas.
//
// Diseño: el sistema de casillas de la nota (`.cas-*`, globals.css). «Ya terminó» es la
// casilla PROTAGONISTA de una previa vieja (lo primero que debe ver quien llega tarde);
// «Antes del partido» es solo navegación y pesa lo mismo que el enlace a la ficha.

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { accentTexto } from '@/lib/sports'

export default function NotaHermanaLink({
  tipo,
  slug,
  partido,
  accent = '#7c3aed',
}: {
  /** La nota a la que se enlaza. */
  tipo: 'cronica' | 'previa'
  slug: string
  /** «Francia 1-1 Italia» o «Francia – Italia». */
  partido: string
  accent?: string
}) {
  const cronica = tipo === 'cronica'
  return (
    <Link
      href={`/noticias/${slug}`}
      prefetch={false}
      className={`ts-ficha-link cas-link${cronica ? ' cas-link--hero' : ''}`}
      style={{ '--acc': accent, '--acc-text': accentTexto(accent) } as CSSProperties}
    >
      <span aria-hidden className="cas-link__icon">
        {cronica ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 21V4" />
            <path d="M5 4h13l-2.5 4L18 12H5" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        )}
      </span>
      <span className="cas-link__body">
        <span className="cas-link__kicker">{cronica ? 'Ya terminó' : 'Antes del partido'}</span>
        <span className="cas-link__title">{partido}</span>
        <span className="cas-link__sub">
          {cronica ? 'Lee la crónica: goles, figura y estadísticas' : 'La previa: lo que se jugaban y cómo llegaban'}
        </span>
      </span>
      <span aria-hidden className="cas-link__arrow">→</span>
    </Link>
  )
}
