// /mundial/fixture — Calendario y resultados del Mundial 2026 (read-only).
// A diferencia de /mundial (predictor de predicciones), esta vista —enlazada
// desde Footer → Ligas → Mundial 2026— muestra el fixture y los resultados
// del torneo como una página de competición clásica.

import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/constants'
import { createClient } from '@supabase/supabase-js'
import ScrollToTop from '@/components/ScrollToTop'

// ISR: página pública de solo-lectura → cacheada, regenera cada 60s. Antes era
// force-dynamic (se re-ejecutaba en CADA visita). getEvents() usa un cliente
// Supabase SIN cookies (los datos son públicos) para NO forzar render dinámico
// — leer cookies, como hace createServerSupabaseClient, fuerza no-store.
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Mundial 2026: calendario y resultados',
  description: 'Calendario completo y resultados del Mundial de Fútbol 2026: partidos, sedes, horarios y marcadores en tiempo real.',
  alternates: { canonical: `${SITE_URL}/mundial/fixture` },
  openGraph: {
    title: 'Mundial 2026 — Calendario y resultados | TakaSports',
    description: 'Todos los partidos del Mundial 2026: fechas, sedes y marcadores.',
    url: `${SITE_URL}/mundial/fixture`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
}

interface MundialEvent {
  id: string
  event_date: string
  team_home: string | null
  team_away: string | null
  status: 'open' | 'closed' | 'resolved'
  result: { winner?: '1' | 'X' | '2'; home_score?: number; away_score?: number } | null
  meta: { group?: string; venue?: string; city?: string } | null
}

// Bandera por nombre de país (inglés, como llega de ESPN). Fallback: globo.
const FLAG: Record<string, string> = {
  'mexico': '🇲🇽', 'canada': '🇨🇦', 'united states': '🇺🇸', 'usa': '🇺🇸',
  'argentina': '🇦🇷', 'brazil': '🇧🇷', 'uruguay': '🇺🇾', 'colombia': '🇨🇴',
  'ecuador': '🇪🇨', 'paraguay': '🇵🇾', 'peru': '🇵🇪', 'chile': '🇨🇱', 'venezuela': '🇻🇪',
  'spain': '🇪🇸', 'france': '🇫🇷', 'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'germany': '🇩🇪', 'portugal': '🇵🇹',
  'italy': '🇮🇹', 'netherlands': '🇳🇱', 'belgium': '🇧🇪', 'croatia': '🇭🇷', 'switzerland': '🇨🇭',
  'denmark': '🇩🇰', 'poland': '🇵🇱', 'austria': '🇦🇹', 'serbia': '🇷🇸', 'turkey': '🇹🇷',
  'ukraine': '🇺🇦', 'scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'norway': '🇳🇴', 'sweden': '🇸🇪',
  'morocco': '🇲🇦', 'senegal': '🇸🇳', 'tunisia': '🇹🇳', 'egypt': '🇪🇬', 'algeria': '🇩🇿',
  'ghana': '🇬🇭', 'nigeria': '🇳🇬', 'cameroon': '🇨🇲', 'ivory coast': '🇨🇮', 'south africa': '🇿🇦',
  'japan': '🇯🇵', 'south korea': '🇰🇷', 'iran': '🇮🇷', 'saudi arabia': '🇸🇦', 'qatar': '🇶🇦',
  'australia': '🇦🇺', 'new zealand': '🇳🇿', 'jamaica': '🇯🇲', 'costa rica': '🇨🇷', 'panama': '🇵🇦',
  'honduras': '🇭🇳', 'uzbekistan': '🇺🇿', 'jordan': '🇯🇴', 'cape verde': '🇨🇻', 'curacao': '🇨🇼',
  'czechia': '🇨🇿', 'czech republic': '🇨🇿', 'bosnia-herzegovina': '🇧🇦', 'bosnia and herzegovina': '🇧🇦',
  'greece': '🇬🇷', 'romania': '🇷🇴', 'hungary': '🇭🇺', 'slovakia': '🇸🇰', 'slovenia': '🇸🇮',
  'republic of ireland': '🇮🇪', 'ireland': '🇮🇪', 'north macedonia': '🇲🇰', 'albania': '🇦🇱',
  'dr congo': '🇨🇩', 'mali': '🇲🇱', 'finland': '🇫🇮', 'kosovo': '🇽🇰', 'iceland': '🇮🇸',
}
function flagFor(team: string | null): string {
  if (!team) return '🏳️'
  return FLAG[team.toLowerCase().trim()] ?? '🏳️'
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })
}
function kickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
}

async function getEvents(): Promise<MundialEvent[]> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )
    const { data, error } = await sb
      .from('ranked_events')
      .select('id, event_date, team_home, team_away, status, result, meta')
      .eq('sport', 'mundial')
      .order('event_date', { ascending: true })
      .limit(200)
    if (error || !data) return []
    return data as MundialEvent[]
  } catch {
    return []
  }
}

export default async function MundialFixturePage() {
  const events = await getEvents()

  // Agrupar por día (Europe/Madrid)
  const byDay = new Map<string, MundialEvent[]>()
  for (const ev of events) {
    const k = dayKey(ev.event_date)
    if (!byDay.has(k)) byDay.set(k, [])
    byDay.get(k)!.push(ev)
  }

  const resolvedCount = events.filter(e => e.status === 'resolved').length

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      {/* Cabecera */}
      <section
        className="w-full"
        style={{
          background: 'linear-gradient(145deg,#1a0b3d,#09090F)',
          borderBottom: '1px solid rgba(167,139,250,0.18)',
        }}
      >
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-6 pb-7" style={{ position: 'relative' }}>
          <nav className="flex items-center gap-1.5 text-[11px] mb-4" aria-label="Breadcrumb">
            <Link href="/" style={{ color: '#55556a', textDecoration: 'none' }} className="hover:opacity-70">TakaSports</Link>
            <span style={{ color: '#55556a' }}>/</span>
            <span className="font-semibold" style={{ color: '#A78BFA' }}>Mundial 2026</span>
          </nav>
          <div className="flex items-center gap-4">
            <span style={{ fontSize: 48, lineHeight: 1 }}>🏆</span>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: '#F0F0FF', letterSpacing: '-0.03em' }}>
                Mundial 2026 · Calendario y resultados
              </h1>
              <p className="mt-1 text-sm" style={{ color: '#9090A8' }}>
                {events.length} partidos · {resolvedCount > 0 ? `${resolvedCount} disputados` : 'el torneo arranca el 11 de junio'}
              </p>
            </div>
          </div>
          {/* CTA al predictor */}
          <Link
            href="/mundial"
            className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-transform hover:translate-x-0.5"
            style={{ background: 'rgba(167,139,250,0.16)', color: '#C4B5FD', border: '1px solid rgba(167,139,250,0.3)', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
          >
            ¿Te atreves a predecir? Juega Ranked Mundial
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5h6.5M5.5 2.5l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 pb-24">
        {events.length === 0 ? (
          <p className="py-20 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            El calendario del Mundial estará disponible muy pronto.
          </p>
        ) : (
          <div className="flex flex-col gap-7">
            {[...byDay.entries()].map(([day, matches]) => (
              <div key={day}>
                {/* Cabecera de día */}
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
                    {day}
                  </h2>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                </div>
                {/* Partidos del día */}
                <div className="flex flex-col gap-2">
                  {matches.map(ev => {
                    const resolved = ev.status === 'resolved' && ev.result
                    const live = ev.status === 'closed'
                    return (
                      <div
                        key={ev.id}
                        className="grid items-center gap-3 px-4 py-3 rounded-xl"
                        style={{
                          gridTemplateColumns: '1fr auto 1fr',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {/* Local */}
                        <div className="flex items-center gap-2 justify-end min-w-0">
                          <span className="text-[13px] font-bold truncate text-right" style={{ color: '#E0E0F0' }}>
                            {ev.team_home ?? 'Por definir'}
                          </span>
                          <span style={{ fontSize: 18, lineHeight: 1 }}>{flagFor(ev.team_home)}</span>
                        </div>
                        {/* Centro: marcador o hora */}
                        <div className="flex flex-col items-center justify-center px-2" style={{ minWidth: 64 }}>
                          {resolved ? (
                            <span className="text-base font-black tabular-nums" style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)' }}>
                              {ev.result!.home_score ?? 0} – {ev.result!.away_score ?? 0}
                            </span>
                          ) : (
                            <span className="text-sm font-black tabular-nums" style={{ color: '#A78BFA', fontFamily: 'var(--font-display)' }}>
                              {kickoff(ev.event_date)}
                            </span>
                          )}
                          <span className="text-[8px] font-black uppercase tracking-widest mt-0.5" style={{ color: live ? '#ef4444' : '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
                            {resolved ? 'Final' : live ? 'En juego' : (ev.meta?.group || 'Fase grupos')}
                          </span>
                        </div>
                        {/* Visitante */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span style={{ fontSize: 18, lineHeight: 1 }}>{flagFor(ev.team_away)}</span>
                          <span className="text-[13px] font-bold truncate" style={{ color: '#E0E0F0' }}>
                            {ev.team_away ?? 'Por definir'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ScrollToTop />
    </div>
  )
}
