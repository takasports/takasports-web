import Link from 'next/link'
import { HOME_EVENTS, ALL_EVENTS } from '@/lib/events'

export default function LiveEventsSection({ preview = true }: { preview?: boolean }) {
  const events = preview ? HOME_EVENTS : ALL_EVENTS

  return (
    <section className="pt-4 pb-0">

      {/* Header — alineado con el grid */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Badge utilitario */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="#8E8E9E" strokeWidth="1.3" />
              <path d="M6 3.5v2.8l1.5 1.5" stroke="#8E8E9E" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <h2
              className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: '#8E8E9E', fontFamily: 'var(--font-sport)' }}
            >
              Calendario
            </h2>
          </div>
          <span className="text-[10px]" style={{ color: '#3A3A4A' }}>·</span>
          <span className="text-[11px]" style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
            {events.length} próximos eventos
          </span>
        </div>
        {preview && (
          <Link
            href="/calendario"
            className="text-[11px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}
          >
            Ver todos →
          </Link>
        )}
      </div>

      {/* Carril — sangra hasta el borde del viewport */}
      <div className="relative -mx-6 xl:-mx-10">
        <div
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 pt-1"
          style={{ paddingLeft: 'max(24px, calc((100vw - 1440px) / 2 + 40px))' }}
        >
          {events.map((event) => (
            <div
              key={event.id}
              className="flex-shrink-0 overflow-hidden transition-all hover:scale-[1.015] hover:shadow-lg cursor-pointer"
              style={{
                width: 196,
                borderRadius: 14,
                background: 'var(--bg-card)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderTop: `2px solid ${event.accent}`,
                boxShadow: `0 4px 20px rgba(0,0,0,0.3), inset 0 0 0 0 transparent`,
              }}
            >
              <div className="px-4 pt-3.5 pb-4 flex flex-col gap-3">

                {/* Deporte + competición */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: event.accent, fontFamily: 'var(--font-sport)' }}
                  >
                    {event.sport}
                  </span>
                  <span
                    className="text-[8px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: `${event.accent}12`,
                      color: event.accent,
                      border: `1px solid ${event.accent}25`,
                      opacity: 0.9,
                    }}
                  >
                    {event.comp}
                  </span>
                </div>

                {/* Matchup */}
                <div className="flex flex-col gap-0.5">
                  <p
                    className="font-black leading-tight"
                    style={{ color: '#F0F0F5', fontFamily: 'var(--font-sport)', fontSize: 14 }}
                  >
                    {event.home}
                  </p>
                  {event.away ? (
                    <p
                      className="font-semibold leading-tight"
                      style={{ color: '#5A5A6E', fontFamily: 'var(--font-sport)', fontSize: 13 }}
                    >
                      vs {event.away}
                    </p>
                  ) : (
                    <p
                      className="font-semibold leading-tight"
                      style={{ color: '#5A5A6E', fontFamily: 'var(--font-sport)', fontSize: 11 }}
                    >
                      &nbsp;
                    </p>
                  )}
                </div>

                {/* Fecha + hora — row más prominente */}
                <div
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: '#7A7A8E' }}
                  >
                    {event.date}
                  </span>
                  <span
                    className="font-black"
                    style={{
                      color: '#E0E0F0',
                      fontFamily: 'var(--font-display)',
                      fontSize: 15,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {event.time}
                  </span>
                </div>

              </div>
            </div>
          ))}

          {/* CTA final */}
          {preview && (
            <Link
              href="/calendario"
              className="flex-shrink-0 flex flex-col items-center justify-center gap-2 transition-opacity hover:opacity-80"
              style={{
                width: 140,
                borderRadius: 14,
                background: 'rgba(124,58,237,0.04)',
                border: '1px dashed rgba(124,58,237,0.18)',
                textDecoration: 'none',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7.5" stroke="#7C3AED" strokeWidth="1.3" opacity="0.4" />
                <path d="M9 5.5v4l2.5 2.5" stroke="#7C3AED" strokeWidth="1.3" strokeLinecap="round" opacity="0.4" />
              </svg>
              <p
                className="text-[10px] text-center leading-relaxed"
                style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}
              >
                Ver todos<br />los eventos →
              </p>
            </Link>
          )}

          {/* Padding final */}
          <div className="flex-shrink-0 w-6 xl:w-10" />
        </div>

        {/* Fade izquierda */}
        <div
          className="absolute left-0 top-0 bottom-2 w-6 xl:w-10 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right,var(--bg-base),transparent)' }}
        />
        {/* Fade derecha */}
        <div
          className="absolute right-0 top-0 bottom-2 w-24 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right,transparent,var(--bg-base))' }}
        />
      </div>
    </section>
  )
}
