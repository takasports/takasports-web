'use client'

import Link from 'next/link'
import type { CompetitionConfig } from '@/lib/calendar-competitions'
import { getCompAccent } from '@/lib/competitions'

// Banner prominente de la competición seleccionada en la PORTADA del calendario.
// La foto IA es genérica; el escudo OFICIAL va superpuesto → identidad inmediata.
// Encuadre 2:1 / 16:5 con foco bajo (object-position 60%) para NO cortar al
// protagonista, que vive en el tercio inferior de la imagen. El tercio izquierdo,
// oscurecido por el degradado, sostiene el escudo + nombre + acceso a la página.
export default function CompetitionBanner({
  comp,
  count,
  onClear,
}: {
  comp: CompetitionConfig
  count: number
  onClear: () => void
}) {
  const accent = getCompAccent(comp.shortName)
  return (
    <section className="cal-anim-in" aria-label={`Competición seleccionada: ${comp.displayName}`}>
      <div className="relative overflow-hidden rounded-2xl" style={{ border: `1px solid ${accent}3a` }}>
        <div className="relative w-full aspect-[2/1] sm:aspect-[16/5]">
          {comp.banner ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={comp.banner}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: '50% 60%' }}
            />
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${accent}22, #0a0a12)` }} />
          )}
          {/* Degradado de legibilidad: izquierda muy oscura (escudo + texto). */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(90deg, rgba(7,7,12,0.94) 0%, rgba(7,7,12,0.62) 46%, rgba(7,7,12,0.30) 100%)' }}
          />
          {/* Contenido */}
          <div className="absolute inset-0 flex items-center gap-3 px-4 sm:px-6">
            {comp.crest && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={comp.crest}
                alt={comp.displayName}
                loading="lazy"
                decoding="async"
                className="flex-shrink-0 object-contain"
                style={{ width: 'clamp(40px, 13vw, 70px)', height: 'clamp(40px, 13vw, 70px)' }}
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="block rounded-sm" style={{ width: 3, height: 12, background: accent }} />
                <span className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
                  {count > 0 ? `${count} ${count === 1 ? 'evento próximo' : 'eventos próximos'}` : 'Calendario'}
                </span>
              </div>
              <h2
                className="font-black leading-tight line-clamp-2"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.2rem, 5.4vw, 1.9rem)', color: '#F8F8FF', letterSpacing: '-0.01em' }}
              >
                {comp.displayName}
              </h2>
              <Link
                href={`/calendario/${comp.slug}`}
                prefetch={false}
                className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold no-underline transition-opacity hover:opacity-80"
                style={{ color: accent, fontFamily: 'var(--font-sport)' }}
              >
                {comp.espnSlug ? 'Clasificación y goleadores' : 'Ver página completa'}
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M4.5 2 8 6l-3.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
          {/* Quitar competición */}
          <button
            onClick={onClear}
            aria-label="Quitar filtro de competición"
            className="absolute top-2 right-2 flex items-center justify-center rounded-full transition-all hover:brightness-125"
            style={{
              width: 28,
              height: 28,
              background: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
