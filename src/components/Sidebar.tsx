import Link from 'next/link'
import QuinielaModule from './QuinielaModule'
import { HOME_EVENTS } from '@/lib/events'

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <span style={{ display: 'block', width: 3, height: 14, background: '#7C3AED', borderRadius: 2 }} />
        <h3 className="section-label">{children}</h3>
      </div>
      {action}
    </div>
  )
}

export default function Sidebar() {
  return (
    <div className="flex flex-col gap-7 pt-1">

      {/* ── Quiniela ────────────────────────────────── */}
      <div>
        <SectionHeader>Quiniela</SectionHeader>
        <QuinielaModule />
      </div>

      {/* ── Próximos ────────────────────────────────── */}
      <div>
        <SectionHeader
          action={
            <Link
              href="/calendario"
              className="text-[10px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}
            >
              Ver todos →
            </Link>
          }
        >
          Próximos
        </SectionHeader>
        <div className="flex flex-col gap-1.5">
          {HOME_EVENTS.length > 0 ? HOME_EVENTS.map((event) => (
            <Link
              key={event.id}
              href="/calendario"
              className="flex items-center justify-between p-2.5 rounded-xl transition-all hover:brightness-110"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${event.accent}`,
                textDecoration: 'none',
              }}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-semibold leading-tight truncate"
                  style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}
                >
                  {event.home}{event.away ? ` vs ${event.away}` : ''}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: event.accent, opacity: 0.7 }}>
                  {event.sport} · {event.comp}
                </p>
              </div>
              <div className="flex-shrink-0 ml-2 text-right">
                <p className="text-[11px] font-black tabular-nums" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                  {event.time}
                </p>
                <p className="text-[9px]" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
                  {event.date}
                </p>
              </div>
            </Link>
          )) : (
            <p className="text-xs px-1" style={{ color: 'var(--text-faint)' }}>
              Próximos eventos próximamente.
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
