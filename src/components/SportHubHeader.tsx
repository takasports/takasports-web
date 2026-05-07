import Link from 'next/link'
import type { RankingEntry } from '@/lib/rankings'
import { getSportEmoji, getSportStyle } from '@/lib/sports'

interface SportEvent {
  _id: string
  sport?: string
  home: string
  away?: string
  date?: string
  venue?: string
  status?: string
  stage?: string
  competition?: { name: string; slug: string }
}

interface Props {
  sport: string
  label: string
  topRankings: RankingEntry[]
  upcomingEvents: SportEvent[]
}

const SPORT_DESCRIPTIONS: Record<string, string> = {
  futbol:     'Noticias, fichajes, resultados de LaLiga, Premier, Champions y más. Índice Taka: los mejores del mundo en tiempo real.',
  baloncesto: 'Todo sobre la NBA: traspasos, resultados, estadísticas y el ranking de los mejores jugadores según el Índice Taka.',
  formula1:   'Resultados de cada GP, clasificaciones, noticias de los equipos y el análisis Taka de los pilotos del momento.',
  tenis:      'ATP, WTA, Grand Slams y Ryder Cup. Resultados, rankings y análisis de los tenistas más influyentes.',
  ufc:        'Carteleras UFC y MMA: resultados de peleas, noticias de fichajes y el ranking Taka de los luchadores del momento.',
  wwe:        'WWE Raw, SmackDown y PPVs: resultados, storylines y el ranking de los creadores de contenido en wrestling.',
  rugby:      'Six Nations, Rugby Championship y Premiership. Resultados, análisis y el índice Taka del rugby mundial.',
}

const TREND_ICON: Record<string, string> = {
  up2: '⬆', up: '↑', flat: '→', down: '↓', down2: '⬇',
}
const TREND_COLOR: Record<string, string> = {
  up2: '#22c55e', up: '#4ade80', flat: '#6b7280', down: '#f87171', down2: '#ef4444',
}

function formatEventDate(dateStr?: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const isToday = d.toDateString() === now.toDateString()
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
  if (isToday) return `HOY ${time}`
  if (isTomorrow) return `MÑN ${time}`
  const dayName = d.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'Europe/Madrid' }).toUpperCase()
  return `${dayName} ${time}`
}

export default function SportHubHeader({ sport, label, topRankings, upcomingEvents }: Props) {
  const emoji = getSportEmoji(label)
  const style = getSportStyle(sport)
  const accent = style.accent
  const description = SPORT_DESCRIPTIONS[sport] ?? `Últimas noticias, resultados y análisis de ${label}.`
  const top5 = topRankings.slice(0, 5)
  const rankingsHref = `/rankings?deporte=${sport}&tab=jugadores`

  return (
    <section
      className="w-full"
      style={{
        background: style.bg,
        borderBottom: `1px solid ${accent}22`,
      }}
    >
      {/* Hero band */}
      <div
        className="max-w-[1440px] mx-auto px-4 md:px-8 pt-10 pb-6"
        style={{ position: 'relative' }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 700,
            height: 300,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        <div className="relative flex flex-col md:flex-row md:items-center gap-3 md:gap-6 mb-8">
          <span style={{ fontSize: 52, lineHeight: 1 }}>{emoji}</span>
          <div>
            <h1
              className="text-4xl md:text-5xl font-black tracking-tight"
              style={{ color: '#F0F0FF', letterSpacing: '-0.03em', lineHeight: 1.05 }}
            >
              {label}
            </h1>
            <p className="mt-1.5 text-sm md:text-base" style={{ color: '#9090A8', maxWidth: 560 }}>
              {description}
            </p>
          </div>
        </div>

        {/* Data cards row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Rankings card */}
          {top5.length > 0 && (
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${accent}22`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: accent }}>
                  Índice Taka · Top {top5.length}
                </span>
                <Link
                  href={rankingsHref}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: `${accent}aa` }}
                >
                  Ver todos →
                </Link>
              </div>
              <ol className="space-y-2">
                {top5.map((entry, i) => (
                  <li key={entry.id} className="flex items-center gap-2.5">
                    <span
                      className="text-xs font-black w-5 text-center shrink-0"
                      style={{ color: i === 0 ? accent : '#5a5a7a' }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold truncate flex-1" style={{ color: '#E0E0F0' }}>
                      {entry.name}
                    </span>
                    <span className="text-xs shrink-0" style={{ color: '#6060808' }}>
                      {entry.subtitle?.split('·')[0]?.trim()}
                    </span>
                    <span
                      className="text-xs font-bold shrink-0 w-8 text-right"
                      style={{ color: accent }}
                    >
                      {entry.score.toFixed(1)}
                    </span>
                    <span
                      className="text-xs shrink-0 w-4 text-center"
                      style={{ color: TREND_COLOR[entry.trend] ?? '#6b7280' }}
                    >
                      {TREND_ICON[entry.trend] ?? '→'}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Events card */}
          {upcomingEvents.length > 0 && (
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${accent}22`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: accent }}>
                  Próximos eventos
                </span>
                <Link
                  href="/calendario"
                  className="text-xs font-semibold hover:underline"
                  style={{ color: `${accent}aa` }}
                >
                  Ver calendario →
                </Link>
              </div>
              <ul className="space-y-2.5">
                {upcomingEvents.slice(0, 4).map(ev => (
                  <li key={ev._id}>
                    <Link
                      href={`/evento/${ev._id}`}
                      className="flex items-center gap-2.5 group"
                    >
                      <span
                        className="text-xs font-bold shrink-0 w-20 text-right"
                        style={{ color: ev.status === 'en_vivo' ? '#ef4444' : `${accent}cc` }}
                      >
                        {ev.status === 'en_vivo' ? '🔴 EN VIVO' : formatEventDate(ev.date)}
                      </span>
                      <span
                        className="text-sm font-semibold truncate group-hover:underline"
                        style={{ color: '#E0E0F0' }}
                      >
                        {ev.away ? `${ev.home} vs ${ev.away}` : ev.home}
                      </span>
                    </Link>
                    {ev.competition?.name && (
                      <p className="text-xs mt-0.5 ml-[88px] truncate" style={{ color: '#55556a' }}>
                        {ev.competition.name}{ev.stage ? ` · ${ev.stage}` : ''}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* If only rankings, no events — show a "no events" placeholder */}
          {top5.length > 0 && upcomingEvents.length === 0 && (
            <div
              className="rounded-xl p-4 flex flex-col items-center justify-center gap-2"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px dashed ${accent}18`,
              }}
            >
              <span style={{ fontSize: 32 }}>📅</span>
              <span className="text-sm" style={{ color: '#5a5a7a' }}>Sin eventos próximos</span>
              <Link
                href="/calendario"
                className="text-xs font-semibold hover:underline mt-1"
                style={{ color: `${accent}99` }}
              >
                Ver calendario completo →
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
