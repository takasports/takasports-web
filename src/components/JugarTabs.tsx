'use client'

import Link from 'next/link'

// Conmutador de las dos mitades de "Jugar".
//
// Desde el 03/09/2026 la barra inferior tiene una sola pestaña, "Jugar", que
// reúne Predicciones y Juegos —antes gastaban dos de las cinco plazas—. Entra
// por /predicciones, que es lo que trae de vuelta, pero /predicciones no
// enlazaba a /juegos por ningún sitio: sin esto, quien llegara desde la barra se
// quedaba sin los minijuegos salvo que abriera el cajón ☰.
//
// Es un enlace, no un estado: cada mitad es su propia página con su ISR y su
// URL compartible; convertirlas en pestañas de verdad habría significado
// fusionar dos rutas que ya funcionan.
export default function JugarTabs({ activo }: { activo: 'predicciones' | 'juegos' }) {
  const partes = [
    { id: 'predicciones' as const, href: '/predicciones', label: 'La Jornada' },
    { id: 'juegos' as const, href: '/juegos', label: 'Juegos' },
  ]

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pt-3">
      <div
        role="tablist"
        aria-label="Secciones de Jugar"
        className="inline-flex items-center p-1 rounded-full"
        style={{ height: 40, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {partes.map(parte => {
          const on = parte.id === activo
          return (
            <Link
              key={parte.id}
              href={parte.href}
              prefetch={false}
              role="tab"
              aria-selected={on}
              aria-current={on ? 'page' : undefined}
              className="px-4 rounded-full text-[12px] font-bold uppercase tracking-[0.08em] transition-colors flex items-center h-full"
              style={{
                textDecoration: 'none',
                background: on ? 'var(--purple)' : 'transparent',
                color: on ? '#fff' : 'var(--text-secondary)',
                fontFamily: 'var(--font-sport)',
              }}
            >
              {parte.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
