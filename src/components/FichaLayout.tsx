// ─────────────────────────────────────────────────────────────────────────────
// FichaLayout — el contenedor único de las fichas hermanas (jugador, equipo,
// liga). V-28 (5.5): el jugador iba a dos columnas a 1.360 px; equipo y liga,
// centradas a 640 con 400 px vacíos a cada lado, y cada una con su propio
// «Volver». Al saltar de jugador a equipo la web «cambiaba de sitio».
//
// Ahora las tres comparten: el mismo ancho, una sola miga «Inicio › Sección ›
// Entidad» (12 px, gris; la miga ya vuelve, así que no hay botón «Volver»),
// las acciones a la derecha de la miga, y dos columnas en escritorio (ficha +
// lateral de últimos partidos, goleadores o noticias) que se apilan en móvil.
// Server component: no necesita estado.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react'
import BreadcrumbsNav, { type BreadcrumbItem } from '@/components/BreadcrumbsNav'

export default function FichaLayout({
  miga,
  acciones,
  lateral,
  children,
}: {
  miga: BreadcrumbItem[]
  /** Compartir, comparar… a la derecha de la miga. */
  acciones?: ReactNode
  /** Columna lateral (escritorio); debajo de la ficha en móvil. */
  lateral?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <BreadcrumbsNav items={miga} className="text-[12px] flex items-center gap-2 flex-wrap min-w-0" />
        {acciones ? <div className="flex items-center gap-3 flex-shrink-0">{acciones}</div> : null}
      </div>
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex-1 min-w-0 w-full">{children}</div>
        {lateral ? <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">{lateral}</aside> : null}
      </div>
    </div>
  )
}
