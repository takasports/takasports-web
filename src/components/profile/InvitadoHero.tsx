'use client'

// La pantalla «Tú» de la app para quien no tiene cuenta (V-37, 5.6): una
// tarjeta «Únete a Taka Sports» con dos botones y tres filas con icono en su
// caja de color. Sustituye al cuadrado «MP» con cuatro cifras en guiones, que
// era la primera impresión de la web para cualquiera sin sesión. Copiado de
// `11-tu-invitado.jpg` de la revisión de noviembre.

import Link from 'next/link'
import { TrophyIcon, BellIcon, TargetIcon } from '@/components/icons/GameIcons'

const FILAS = [
  {
    href: '#guardados',
    titulo: 'Guardados',
    sub: 'Noticias que te guardas',
    color: '#F87171',
    icono: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.2a.3.3 0 0 1-.47.25L8 10.6l-4.03 2.85a.3.3 0 0 1-.47-.25V3a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  { href: '/predicciones', titulo: 'Mis predicciones', sub: 'Historial y puntuación', color: '#FBBF24', icono: <TargetIcon size={20} /> },
  { href: '/calendario', titulo: 'Recordatorios', sub: 'Partidos que no te quieres perder', color: '#A78BFA', icono: <BellIcon size={20} /> },
]

export default function InvitadoHero({ onEntrar, onCrearCuenta }: { onEntrar: () => void; onCrearCuenta: () => void }) {
  return (
    <div className="pt-6 pb-8 flex flex-col gap-5">
      <div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.28)' }}
      >
        <div className="flex items-start gap-4">
          <span
            className="inline-flex items-center justify-center flex-shrink-0 rounded-2xl"
            style={{ width: 56, height: 56, background: 'var(--purple)', color: '#fff', boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }}
          >
            <TrophyIcon size={26} />
          </span>
          <div className="min-w-0">
            <h2 className="leading-none" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)' }}>
              Únete a Taka Sports
            </h2>
            <p className="text-[14px] mt-1.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Guarda favoritos, compite en predicciones y recibe alertas.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onEntrar}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-[13px] font-bold uppercase tracking-[0.04em] transition-opacity hover:opacity-90"
            style={{ height: 44, background: 'var(--purple)', color: '#fff', fontFamily: 'var(--font-sport)', border: 'none', cursor: 'pointer' }}
          >
            Iniciar sesión →
          </button>
          <button
            type="button"
            onClick={onCrearCuenta}
            className="flex-1 inline-flex items-center justify-center rounded-xl text-[14px] font-semibold transition-colors hover:border-white/20"
            style={{ height: 44, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-2)', cursor: 'pointer' }}
          >
            Crear cuenta
          </button>
        </div>
      </div>

      <div className="ts-lista">
        {FILAS.map((f) => (
          <Link key={f.href} href={f.href} className="flex items-center gap-3.5 no-underline transition-colors hover:bg-white/[0.03]" style={{ padding: '14px 16px' }}>
            <span
              className="inline-flex items-center justify-center flex-shrink-0 rounded-xl"
              style={{ width: 44, height: 44, background: `color-mix(in srgb, ${f.color} 14%, var(--bg-surface))`, color: f.color }}
            >
              {f.icono}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[17px] font-bold leading-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sport)' }}>{f.titulo}</span>
              <span className="block text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{f.sub}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: 'var(--text-muted)' }}>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
