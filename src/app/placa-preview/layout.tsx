import type { Metadata } from 'next'

// /placa-preview es una maqueta interna de desarrollo (la página es 'use client',
// que NO puede exportar metadata) → este layout de servidor le pone noindex para
// que no aparezca en Google en producción.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PlacaPreviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
