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
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { ShareButton } from '@/components/ShareButton'
import { getArchivedDays } from '@/lib/past-events'
import { matchStakes, standingLabel } from '@/lib/match-stakes'
import type { SportEvent } from '@/lib/types'
import { SITE_URL } from '@/lib/constants'
import {
  addDays, dayPageDescription, dayPageTitle, dayShareTitle, isValidDayParam,
  longDayLabel, relativeDayLabel, servableDays, shortDayLabel,
} from '@/lib/calendar-day-page'
import { dayChannel, dayStars, loadDay, todayIso } from '@/lib/calendar-day-data'
import { compConfigForGroup } from '@/lib/calendar-competitions'

export const revalidate = 300

// Enumeramos TODA la ventana servible y cerramos la puerta a lo demás.
//
// Con `dynamicParams` abierto, un `notFound()` aquí devolvía **200** con el
// cuerpo del 404: el ISR prerenderiza el fallo y lo sirve cacheado
// (`x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`). Un soft 404 es justo lo que
// no queremos en una ruta creada para SEO. Cerrando la lista, el 404 lo emite
// Next antes de entrar en la página — mismo criterio que /calendario/[slug].
//
// Contrapartida asumida: la lista se congela en el build. Como Vercel despliega
// en cada push, la ventana se refresca sola; lo único que envejece es el borde
// del futuro, y el archivo solo puede quedarse corto por el último día o dos.
export async function generateStaticParams() {
  // Además de la ventana viva, todos los días que YA tienen resultados
  // archivados: eran ~130 y solo se servían los 30 últimos, así que cien días
  // de marcadores reales daban 404 mientras «resultados del 22 de agosto» es
  // una búsqueda que existe cada día del año.
  const archived = await getArchivedDays().catch(() => [] as string[])
  return servableDays(todayIso(), archived).map(fecha => ({ fecha }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ fecha: string }>
}): Promise<Metadata> {
  const { fecha } = await params
  if (!isValidDayParam(fecha)) return { title: 'Calendario' }
  const t = todayIso()
  // Con dynamicParams=false solo llegan aquí fechas que enumeró el build, así
  // que se carga sin más: el guardia de ventana descartaba justo los días del
  // archivo que ahora sí servimos.
  const events = await loadDay(fecha)
  const title = dayPageTitle(fecha, t)
  // Los partidos estrella con el MISMO ranking que Destacados y el mismo canal
  // que pinta la fila de abajo.
  const description = dayPageDescription(fecha, events.length, t, dayStars(events))
  const url = `${SITE_URL}/calendario/dia/${fecha}`
  // Lo que se ve al COMPARTIR lleva la fecha, nunca «hoy»: el enlace se abre
  // horas o días después y el título de la página (pensado para Google, que lo
  // recalcula cada 5 minutos) caducaría en el chat. La imagen la pone sola
  // opengraph-image.tsx; el `twitter:image` hay que decírselo, porque el layout
  // de /calendario hereda el logo.
  const shareTitle = dayShareTitle(fecha, t)
  return {
    // Sin « | TakaSports»: ya lo pone la plantilla del layout raíz, y con los
    // dos el título salía con la marca repetida y Google lo cortaba antes.
    title,
    description,
    alternates: { canonical: url },
    // Un día sin un solo partido no aporta nada al índice.
    robots: events.length === 0 ? { index: false, follow: true } : undefined,
    openGraph: { title: shareTitle, description, url, type: 'website', siteName: 'TakaSports', locale: 'es_ES' },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description,
      site: '@takasportsx',
      images: [`${url}/opengraph-image`],
    },
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
          {/* Compartir el día: el enlace se abre con su tarjeta (opengraph-image)
              y el texto lleva la FECHA, no «hoy», para que no caduque en el chat.
              Se comparte el enlace, no la imagen como archivo: así WhatsApp pinta
              la vista previa con la tarjeta y el enlace sigue siendo clicable. */}
          <div className="mb-1 flex items-start justify-between gap-3">
            <h1
              className="min-w-0"
              style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, color: '#F0F0FA', lineHeight: 1.05 }}
            >
              {rel ? `Partidos de ${rel.toLowerCase()}` : `Partidos del ${shortDayLabel(fecha)}`}
            </h1>
            <div className="flex-shrink-0 pt-1">
              <ShareButton title={dayShareTitle(fecha, t)} text={`${dayShareTitle(fecha, t)}: horarios y dónde verlos`} />
            </div>
          </div>
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
            {order.map((comp) => {
              const first = byComp.get(comp)![0]
              const compColor = first.accent ?? '#A78BFA'
              // Las competiciones con calendario propio enlazan a él: el día es
              // la puerta de entrada de quien busca «partidos de hoy», y su
              // siguiente pregunta suele ser «¿y cuándo vuelve a jugar LaLiga?».
              // Sin prefetch: son páginas ISR pesadas y una página de día pinta
              // hasta una docena de rótulos (ver el incidente del prefetch de
              // /comparar).
              const cfg = compConfigForGroup(comp, first.sport)
              return (
              <section key={comp}>
                {cfg ? (
                  <h2 className="mb-2" style={{ fontFamily: 'var(--font-sport)' }}>
                    <Link
                      href={`/calendario/${cfg.slug}`}
                      prefetch={false}
                      aria-label={`Ver el calendario de ${cfg.displayName}`}
                      className="group flex items-center justify-between gap-3 no-underline"
                    >
                      <span
                        className="truncate text-[11px] font-black uppercase tracking-[0.14em] group-hover:brightness-125"
                        style={{ color: compColor }}
                      >
                        {comp}
                      </span>
                      <span
                        className="flex-shrink-0 text-[10px] font-black uppercase tracking-[0.12em] transition-colors group-hover:text-[#C4B5FD]"
                        style={{ color: '#8A8A9E' }}
                      >
                        Calendario →
                      </span>
                    </Link>
                  </h2>
                ) : (
                  <h2
                    className="mb-2 text-[11px] font-black uppercase tracking-[0.14em]"
                    style={{ color: compColor, fontFamily: 'var(--font-sport)' }}
                  >
                    {comp}
                  </h2>
                )}
                <ul className="flex flex-col gap-2">
                  {byComp.get(comp)!.map((e) => {
                    const stakes = matchStakes(e.homeStanding, e.awayStanding)
                    const channel = dayChannel(e)
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
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
