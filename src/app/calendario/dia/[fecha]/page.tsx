// Página de UN día del calendario: /calendario/dia/2026-08-21
//
// Existe por SEO: "qué partidos hay hoy", "partidos 22 de agosto" y similares son
// búsquedas con intención clara que hasta ahora solo podían caer en /calendario
// (una única URL para los 45 días). Cada día pasa a tener su URL indexable, con
// su <title>, su descripción y su JSON-LD de eventos.
//
// Ruta propia en vez de /calendario/[fecha] porque ese segmento es el de
// competiciones y tiene `dynamicParams = false` a propósito (slug inventado →
// 404 real). Ver lib/calendar-day-page.ts.

import type { Metadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { fetchEspnEvents } from '@/lib/espn'
import { fetchPadelEvents } from '@/lib/padel'
import { sanityClient, eventsQuery } from '@/lib/sanity'
import { normalizeEvent } from '@/lib/events'
import { searchPastEvents } from '@/lib/past-events'
import { attachH2HNotes } from '@/lib/h2h-notes'
import { matchStakes, standingLabel } from '@/lib/match-stakes'
import { getBroadcastForTz } from '@/lib/broadcasts'
import { SOURCE_TZ } from '@/lib/timezone'
import { isoToLocalDate } from '@/lib/calendar'
import type { SportEvent } from '@/lib/types'
import { SITE_URL, LOGO_URL } from '@/lib/constants'
import {
  DAY_PAGE_FUTURE, DAY_PAGE_PAST, addDays, dayPageDescription, dayPageTitle,
  isServableDay, isValidDayParam, longDayLabel, relativeDayLabel, shortDayLabel,
} from '@/lib/calendar-day-page'

export const revalidate = 300

/** Hoy en la zona base del producto (Europe/Madrid), igual que el calendario. */
function todayIso(): string {
  return isoToLocalDate(new Date().toISOString(), SOURCE_TZ)
}

// Enumeramos TODA la ventana servible y cerramos la puerta a lo demás.
//
// Con `dynamicParams` abierto, un `notFound()` aquí devolvía **200** con el
// cuerpo del 404: el ISR prerenderiza el fallo y lo sirve cacheado
// (`x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`). Un soft 404 es justo lo que
// no queremos en una ruta creada para SEO. Cerrando la lista, el 404 lo emite
// Next antes de entrar en la página — mismo criterio que /calendario/[slug].
//
// Contrapartida asumida: la lista se congela en el build. Como Vercel despliega
// en cada push, la ventana se refresca sola; y aunque pasara un mes sin
// desplegar seguiría cubriendo lo que anuncia el sitemap (-1 … +14 días).
export async function generateStaticParams() {
  const t = todayIso()
  const out: { fecha: string }[] = []
  for (let n = -DAY_PAGE_PAST; n <= DAY_PAGE_FUTURE; n++) out.push({ fecha: addDays(t, n) })
  return out
}

export const dynamicParams = false

/** Eventos de ese día (futuros del feed + resultados archivados). Memoizado por
 *  request para que generateMetadata y la página no dupliquen los fetch. */
const loadDay = cache(async (fecha: string): Promise<SportEvent[]> => {
  const [espnRes, sanityRes, padelRes, pastRes] = await Promise.allSettled([
    fetchEspnEvents(),
    sanityClient.fetch(eventsQuery),
    fetchPadelEvents(),
    // `to` es exclusivo en searchPastEvents → pedimos [fecha, fecha+1).
    searchPastEvents({ from: fecha, to: addDays(fecha, 1), limit: 200 }),
  ])
  const espn = espnRes.status === 'fulfilled' ? espnRes.value : []
  const padel = padelRes.status === 'fulfilled' ? padelRes.value : []
  const sanity = sanityRes.status === 'fulfilled' && Array.isArray(sanityRes.value)
    ? sanityRes.value.map(normalizeEvent)
    : []
  const past = pastRes.status === 'fulfilled' ? (pastRes.value?.events ?? []) : []

  const sameDay = (e: SportEvent) => e.isoDate && isoToLocalDate(e.isoDate, SOURCE_TZ) === fecha

  // El archivado manda sobre el feed (trae marcador); dedup por id y por pareja.
  const out: SportEvent[] = []
  const seenIds = new Set<string>()
  const seenPairs = new Set<string>()
  const pairKey = (e: SportEvent) =>
    `${(e.sport ?? '').toLowerCase()}|${[e.home, e.away ?? ''].map(s => s.toLowerCase().trim()).sort().join('~')}`

  for (const e of [...past, ...sanity, ...espn, ...padel].filter(sameDay)) {
    if (seenIds.has(e.id)) continue
    if (e.away) {
      const k = pairKey(e)
      if (seenPairs.has(k)) continue
      seenPairs.add(k)
    }
    seenIds.add(e.id)
    out.push(e)
  }
  out.sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? ''))
  await attachH2HNotes(out)
  return out
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ fecha: string }>
}): Promise<Metadata> {
  const { fecha } = await params
  if (!isValidDayParam(fecha)) return { title: 'Calendario | TakaSports' }
  const t = todayIso()
  const events = isServableDay(fecha, t) ? await loadDay(fecha) : []
  const title = dayPageTitle(fecha, t)
  const description = dayPageDescription(fecha, events.length)
  const url = `${SITE_URL}/calendario/dia/${fecha}`
  return {
    title: `${title} | TakaSports`,
    description,
    alternates: { canonical: url },
    // Un día sin un solo partido no aporta nada al índice.
    robots: events.length === 0 ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url, type: 'website', images: [{ url: LOGO_URL }] },
  }
}

function timeLabel(e: SportEvent): string {
  if (e.homeScore != null && e.awayScore != null) return `${e.homeScore} - ${e.awayScore}`
  return e.time || '—'
}

export default async function DiaPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params
  const t = todayIso()
  // Cinturón por si la página prerenderizada envejece fuera de la ventana (la
  // lista de params es del build). Con dynamicParams=false esto casi no salta.
  if (!isValidDayParam(fecha)) notFound()

  const events = await loadDay(fecha)
  const rel = relativeDayLabel(fecha, t)
  const prev = addDays(fecha, -1)
  const next = addDays(fecha, 1)

  // Agrupado por competición, en el orden en que aparece el primer partido.
  const order: string[] = []
  const byComp = new Map<string, SportEvent[]>()
  for (const e of events) {
    const key = e.comp || e.sport || 'Otros'
    if (!byComp.has(key)) { byComp.set(key, []); order.push(key) }
    byComp.get(key)!.push(e)
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: dayPageTitle(fecha, t),
    numberOfItems: events.length,
    itemListElement: events.slice(0, 60).map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SportsEvent',
        name: e.away ? `${e.home} vs ${e.away}` : e.home,
        startDate: e.isoDate,
        eventStatus: 'https://schema.org/EventScheduled',
        ...(e.venue ? { location: { '@type': 'Place', name: e.venue } } : {}),
        ...(e.away
          ? {
              homeTeam: { '@type': 'SportsTeam', name: e.home },
              awayTeam: { '@type': 'SportsTeam', name: e.away },
            }
          : {}),
        description: e.comp,
        url: e.matchRef ? `${SITE_URL}/partido/${e.matchRef}` : `${SITE_URL}/calendario/dia/${fecha}`,
      },
    })),
  }

  return (
    <>
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
        <nav className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Link href="/calendario" className="no-underline hover:brightness-125" style={{ color: '#A78BFA' }}>
            Calendario
          </Link>
          <span className="mx-1.5">/</span>
          <span>{shortDayLabel(fecha)}</span>
        </nav>

        <header className="mb-6">
          <h1
            className="mb-1"
            style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, color: '#F0F0FA', lineHeight: 1.05 }}
          >
            {rel ? `Partidos de ${rel.toLowerCase()}` : `Partidos del ${shortDayLabel(fecha)}`}
          </h1>
          <p className="text-sm first-letter:uppercase" style={{ color: 'var(--text-muted)' }}>
            {longDayLabel(fecha)} · {events.length} {events.length === 1 ? 'partido' : 'partidos'}
          </p>
        </header>

        {/* Día anterior / siguiente: navegación real entre las URLs de día, que
            además le da a Google un camino para rastrearlas todas. */}
        <div className="mb-6 flex items-center justify-between gap-3 text-xs">
          <Link
            href={`/calendario/dia/${prev}`}
            className="rounded-lg px-3 py-2 no-underline hover:brightness-125"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: '#C4B5FD' }}
          >
            ‹ {shortDayLabel(prev)}
          </Link>
          <Link
            href="/calendario"
            className="no-underline hover:brightness-125"
            style={{ color: 'var(--text-muted)' }}
          >
            Ver calendario completo
          </Link>
          <Link
            href={`/calendario/dia/${next}`}
            className="rounded-lg px-3 py-2 no-underline hover:brightness-125"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: '#C4B5FD' }}
          >
            {shortDayLabel(next)} ›
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="rounded-xl px-4 py-8 text-center text-sm" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
            No hay partidos programados para este día.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {order.map((comp) => (
              <section key={comp}>
                <h2
                  className="mb-2 text-[11px] font-black uppercase tracking-[0.14em]"
                  style={{ color: byComp.get(comp)![0].accent ?? '#A78BFA', fontFamily: 'var(--font-sport)' }}
                >
                  {comp}
                </h2>
                <ul className="flex flex-col gap-2">
                  {byComp.get(comp)!.map((e) => {
                    const stakes = matchStakes(e.homeStanding, e.awayStanding)
                    const channel = getBroadcastForTz(e.comp ?? '', e.sport ?? '', SOURCE_TZ) ?? e.broadcast
                    const meta = [e.stage, e.venue, channel].filter(Boolean).join(' · ')
                    const ranks = [standingLabel(e.homeStanding), standingLabel(e.awayStanding)]
                    const row = (
                      <div className="flex items-center gap-4">
                        <div
                          className="flex-shrink-0 text-sm font-bold tabular-nums"
                          style={{ color: e.accent ?? '#A78BFA', fontFamily: 'var(--font-sport)', minWidth: 58 }}
                        >
                          {timeLabel(e)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold" style={{ color: '#E8E8F4' }}>
                            {e.away ? `${e.home} vs ${e.away}` : e.home}
                            {stakes ? (
                              <span
                                className="ml-2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                                style={{ color: '#FCD34D', background: 'rgba(252,211,77,0.1)', border: '1px solid rgba(252,211,77,0.28)' }}
                              >
                                {stakes.label}
                              </span>
                            ) : null}
                          </p>
                          {ranks[0] && ranks[1] ? (
                            <p className="truncate text-[11px] tabular-nums" style={{ color: '#7A7A8E' }}>
                              {ranks[0]} · {ranks[1]}
                            </p>
                          ) : null}
                          {e.h2hNote ? (
                            <p className="truncate text-[11px]" style={{ color: '#9A8B6A' }}>{e.h2hNote}</p>
                          ) : null}
                          {meta ? (
                            <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{meta}</p>
                          ) : null}
                        </div>
                      </div>
                    )
                    return (
                      <li
                        key={e.id}
                        className="rounded-xl px-4 py-3"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                      >
                        {e.matchRef ? (
                          <Link href={`/partido/${e.matchRef}`} prefetch={false} className="block no-underline hover:brightness-125">
                            {row}
                          </Link>
                        ) : row}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
