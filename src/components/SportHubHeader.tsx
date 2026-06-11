import Link from 'next/link'
import type { RankingEntry } from '@/lib/rankings'
import { getSportEmoji, getSportStyle } from '@/lib/sports'
import { SITE_URL } from '@/lib/constants'
import { CalendarIcon, LiveDotIcon } from '@/components/icons/GameIcons'

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
  baloncesto: 'NBA, Euroliga, ACB y más: traspasos, resultados, estadísticas y el ranking de los mejores jugadores según el Índice Taka.',
  formula1:   'Resultados de cada GP, clasificaciones, noticias de los equipos y el análisis Taka de los pilotos del momento.',
  tenis:      'ATP, WTA, Grand Slams y Ryder Cup. Resultados, rankings y análisis de los tenistas más influyentes.',
  ufc:        'Carteleras UFC y MMA: resultados de peleas, noticias de fichajes y el ranking Taka de los luchadores del momento.',
  wwe:        'WWE Raw, SmackDown y PPVs: resultados, storylines y el ranking de los creadores de contenido en wrestling.',
  rugby:      'Six Nations, Rugby Championship y Premiership. Resultados, análisis y el índice Taka del rugby mundial.',
}

const SPORT_FAQS: Record<string, Array<{ q: string; a: string }>> = {
  futbol: [
    { q: '¿Cómo funciona el Índice Taka de fútbol?', a: 'El Índice Taka combina rendimiento estadístico, contexto del equipo, impacto mediático y narrativa deportiva en una puntuación del 0 al 100. Se actualiza semanalmente.' },
    { q: '¿Con qué frecuencia se actualizan las noticias de fútbol?', a: 'TakaSports publica noticias de fútbol cada hora, cubriendo LaLiga, Premier League, Champions League, Bundesliga y más competiciones.' },
  ],
  baloncesto: [
    { q: '¿Cómo funciona el Índice Taka NBA?', a: 'El Índice Taka NBA evalúa el rendimiento estadístico, impacto en el equipo, influencia mediática y contexto de la temporada de cada jugador. Se actualiza semanalmente.' },
    { q: '¿Qué competiciones de baloncesto cubre TakaSports?', a: 'TakaSports cubre la NBA, incluyendo noticias de equipos, fichajes, resultados de partidos y análisis de playoffs.' },
  ],
  formula1: [
    { q: '¿Cómo se calcula el Índice Taka de F1?', a: 'El Índice Taka de F1 pondera resultados de carrera, posiciones en parrilla, estrategia y consistencia de temporada. Se actualiza después de cada GP.' },
    { q: '¿Qué información de F1 puedo encontrar en TakaSports?', a: 'TakaSports cubre todos los Grandes Premios de Fórmula 1: resultados, clasificaciones, noticias de equipos y análisis de temporada.' },
  ],
  tenis: [
    { q: '¿Qué torneos de tenis cubre TakaSports?', a: 'TakaSports cubre ATP, WTA, los cuatro Grand Slams (Wimbledon, Roland Garros, US Open, Australian Open) y Masters 1000.' },
    { q: '¿Cómo se calcula el Índice Taka de tenis?', a: 'El Índice Taka de tenis combina ranking ATP/WTA, rendimiento en superficies, victorias en torneos importantes y presencia mediática.' },
  ],
  ufc: [
    { q: '¿Qué eventos UFC cubre TakaSports?', a: 'TakaSports cubre todos los eventos UFC y las principales peleas de MMA: carteleras, resultados, noticias de contrataciones y análisis.' },
    { q: '¿Cómo se calcula el Índice Taka de UFC?', a: 'El Índice Taka UFC evalúa récord de victorias, calidad de rivales, método de victoria, actividad y popularidad mediática del luchador.' },
  ],
  wwe: [
    { q: '¿Qué contenido de WWE cubre TakaSports?', a: 'TakaSports cubre WWE Raw, SmackDown, NXT y todos los PPVs: resultados, storylines, noticias de fichajes y cambios de título.' },
    { q: '¿Cómo se calcula el Índice Taka de WWE?', a: 'El Índice Taka WWE mide tiempo de pantalla, títulos ganados, reacciones del público, redes sociales e impacto en storylines.' },
  ],
  rugby: [
    { q: '¿Qué competiciones de rugby cubre TakaSports?', a: 'TakaSports cubre el Six Nations, Rugby Championship, Premiership inglesa, Top 14 francés y el Rugby World Cup.' },
    { q: '¿Cómo se calcula el Índice Taka de rugby?', a: 'El Índice Taka de rugby combina estadísticas de partido, impacto en el equipo nacional, presencia en torneos internacionales e influencia mediática.' },
  ],
}

// Etiqueta del ranking en el banner por deporte. La mayoría muestran el
// "Índice Taka"; los deportes con ranking propio (UFC = libra por libra)
// usan su nomenclatura específica.
const RANKING_LABEL: Record<string, string> = {
  ufc: 'Libra por libra',
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
  const rankingLabel = RANKING_LABEL[sport] ?? 'Índice Taka'
  const rankingsHref = `/rankings?deporte=${sport}&tab=jugadores`

  // Fondo atmosférico por deporte (reusa los WebP de /calendario, $0). rugby y
  // wwe aún no tienen asset propio (IA pendiente) → caen al neutro 'default'.
  const bdKey = ({ futbol: 'futbol', baloncesto: 'nba', formula1: 'f1', tenis: 'tenis', ufc: 'ufc', padel: 'padel' } as Record<string, string>)[sport] ?? 'default'

  // FAQ JSON-LD — dinámico: primera pregunta usa el jugador #1 si hay ranking
  const baseFaqs = SPORT_FAQS[sport] ?? []
  const dynamicFaqs = top5.length > 0
    ? [
        {
          q: `¿Quién es el mejor ${label === 'Baloncesto' || label === 'NBA' ? 'jugador de baloncesto' : label === 'F1' ? 'piloto de F1' : `jugador de ${label.toLowerCase()}`} del mundo ahora mismo?`,
          a: `Según el Índice Taka, ${top5[0].name} es actualmente el número 1 con una puntuación de ${top5[0].score.toFixed(1)}/100. ${top5[0].trendReason ?? `Ocupa el puesto #1 en el ranking global de ${label}.`}`,
        },
        ...baseFaqs,
      ]
    : baseFaqs

  const faqJsonLd = dynamicFaqs.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: dynamicFaqs.map(faq => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      }
    : null

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: label, item: `${SITE_URL}/${sport}` },
    ],
  }

  return (
    <>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <section
        data-sport={sport}
        className="w-full relative overflow-hidden"
        style={{
          background: style.bg,
          borderBottom: `1px solid ${accent}22`,
        }}
      >
        {/* Fondo atmosférico del deporte (broadcast) — reusa los WebP de
            /calendario. Decorativo: background-image (sin <img>, sin coste de
            lint), muy oscurecido por el scrim para no competir con el texto. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `url(/banners/backdrop-${bdKey}.webp)`,
            backgroundSize: 'cover', backgroundPosition: 'center 28%',
            opacity: 0.4,
          }}
        />
        {/* Scrim de legibilidad: oscurece de arriba a abajo hasta fundir con el fondo */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(9,9,15,0.50) 0%, rgba(9,9,15,0.74) 52%, #09090F 100%)',
          }}
        />
        {/* Tinte de acento del deporte (firma cromática) */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(ellipse 120% 80% at 50% 0%, ${accent}24 0%, transparent 58%)`,
          }}
        />
        <div
          className="max-w-[1440px] mx-auto px-4 md:px-8 pt-6 pb-6"
          style={{ position: 'relative' }}
        >

          {/* Breadcrumb nav */}
          <nav className="hero-enter relative flex items-center gap-1.5 text-[11px] mb-5" aria-label="Breadcrumb" style={{ animationDelay: '0ms' }}>
            <Link href="/" className="hover:opacity-70 transition-opacity" style={{ color: 'var(--text-faint, #55556a)', textDecoration: 'none' }}>
              TakaSports
            </Link>
            <span style={{ color: 'var(--text-faint, #55556a)' }}>/</span>
            <Link href="/noticias" className="hover:opacity-70 transition-opacity" style={{ color: 'var(--text-faint, #55556a)', textDecoration: 'none' }}>
              Noticias
            </Link>
            <span style={{ color: 'var(--text-faint, #55556a)' }}>/</span>
            <span className="font-semibold" style={{ color: accent }}>{label}</span>
          </nav>

          {/* Sport identity */}
          <div className="hero-enter relative flex flex-col md:flex-row md:items-center gap-3 md:gap-6 mb-8" style={{ animationDelay: '80ms' }}>
            <span
              className="shrink-0"
              aria-hidden="true"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 64, height: 64, borderRadius: 16, fontSize: 38, lineHeight: 1,
                background: `${accent}1a`, border: `1px solid ${accent}33`,
                boxShadow: `0 8px 24px ${accent}14`,
              }}
            >
              {emoji}
            </span>
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

          {/* Data cards */}
          <div className="hero-enter grid grid-cols-1 md:grid-cols-2 gap-4" style={{ animationDelay: '160ms' }}>

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
                    {rankingLabel} · Top {top5.length}
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
                      <Link
                        href={`/rankings/${entry.id}`}
                        className="text-sm font-semibold truncate flex-1 hover:underline"
                        style={{ color: '#E0E0F0' }}
                      >
                        {entry.name}
                      </Link>
                      <span className="text-xs shrink-0 truncate max-w-[80px] hidden sm:block" style={{ color: '#55556a' }}>
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
                          className="text-xs font-bold shrink-0 w-20 text-right inline-flex items-center justify-end gap-1"
                          style={{ color: ev.status === 'en_vivo' ? '#ef4444' : `${accent}cc` }}
                        >
                          {ev.status === 'en_vivo'
                            ? (<><LiveDotIcon size={7} /> EN VIVO</>)
                            : formatEventDate(ev.date)}
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

            {/* No events placeholder */}
            {top5.length > 0 && upcomingEvents.length === 0 && (
              <div
                className="rounded-xl p-4 flex flex-col items-center justify-center gap-2"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px dashed ${accent}18`,
                }}
              >
                <span style={{ color: `${accent}aa` }}><CalendarIcon size={34} /></span>
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
    </>
  )
}
