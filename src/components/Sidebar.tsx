import Link from 'next/link'
import QuinielaModule from './QuinielaModule'

const UPCOMING = [
  { home: 'Real Madrid', away: 'Atlético', time: 'Hoy · 21:00',    sport: 'Fútbol', accent: '#22c55e' },
  { home: 'Lakers',      away: 'Celtics',  time: 'Mañana · 02:30', sport: 'NBA',    accent: '#f59e0b' },
  { home: 'GP Japón',    away: null,       time: 'Dom · 07:00',    sport: 'F1',     accent: '#ef4444' },
]

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
          {UPCOMING.map((event, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2.5 rounded-xl transition-all hover:brightness-105"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${event.accent}`,
              }}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-semibold leading-tight"
                  style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}
                >
                  {event.home}{event.away ? ` vs ${event.away}` : ''}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: event.accent, opacity: 0.7 }}>
                  {event.sport}
                </p>
              </div>
              <span
                className="text-[11px] font-black flex-shrink-0 ml-2"
                style={{ color: '#6B6B7B', fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
              >
                {event.time}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
