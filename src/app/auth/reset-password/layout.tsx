import type { Metadata } from 'next'

// page.tsx es 'use client' y no puede exportar metadata. Sin este layout la página
// heredaba title y description del root (duplicando los de la home) y además era
// indexable: es el último paso del flujo de recuperación de contraseña, no tiene
// ningún valor en buscadores.
export const metadata: Metadata = {
  title: 'Restablecer contraseña',
  robots: { index: false, follow: false },
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
