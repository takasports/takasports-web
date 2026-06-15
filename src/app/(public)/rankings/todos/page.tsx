import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Reyes del deporte hispano · Índice Taka',
  description: 'El #1 de cada disciplina. Una foto del momento del deporte hispanohablante.',
  alternates: { canonical: `${SITE_URL}/rankings/todos` },
}

export const revalidate = 3600  // 1 hora — datos cambian ~1x/semana; antes 2 min (recálculo continuo de ranking_view)

interface Row {
  id: string
  name: string
  subtitle: string | null
  sport: string | null
  category: string
  score: number
  rank: number | null
  image_url: string | null
  score_prev: number | null
}

// Solo disciplinas con datos reales (jugadores/jugadoras) en el Índice — el
// resto no tiene ingest, así que iterarlas era pedir queries siempre vacías.
const SPORTS_ORDER = [
  { sport: 'futbol',     label: 'Fútbol',           emoji: '⚽' },
  { sport: 'tenis',      label: 'Tenis',            emoji: '🎾' },
  { sport: 'baloncesto', label: 'Baloncesto · NBA', emoji: '🏀' },
  { sport: 'formula1',   label: 'Fórmula 1',        emoji: '🏎️' },
  { sport: 'ufc',        label: 'UFC',              emoji: '🥊' },
  { sport: 'wwe',        label: 'WWE',              emoji: '🤼' },
]

async function loadKings(): Promise<Row[]> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  // Para cada deporte traemos el top-1 entre jugadores/jugadoras EXCLUSIVAMENTE.
  // Defensa explícita: nunca traemos creadores/periodistas/clubes acá.
  const fetches = SPORTS_ORDER.map(({ sport }) =>
    sb.from('ranking_view')
      .select('id,name,subtitle,sport,category,score,rank,image_url,score_prev')
      .in('category', ['jugadores', 'jugadoras'])
      .eq('sport', sport)
      .order('score', { ascending: false })
      .limit(1)
      .then(({ data }) => (data ?? [])[0] as Row | undefined),
  )
  const results = await Promise.all(fetches)
  // Doble check defensivo — si algo escapa al filtro SQL, no se renderiza
  return results
    .filter((r): r is Row => !!r && (r.category === 'jugadores' || r.category === 'jugadoras'))
}

export default async function ReyesPage() {
  const kings = await loadKings()
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', padding: '24px 16px 80px' }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/rankings"
          className="inline-block text-[10px] font-black uppercase tracking-[0.2em] mb-3"
          style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}>
          ← Volver al Índice
        </Link>
        <h1 className="text-3xl font-black mb-1"
          style={{ color: '#E8E8F0', fontFamily: 'var(--font-display)' }}>
          Reyes del <span style={{ color: '#C4B5FD' }}>deporte hispano</span>
        </h1>
        <p className="text-sm mb-6" style={{ color: '#8E8E9E', fontFamily: 'var(--font-sport)' }}>
          El #1 de cada disciplina según el Índice Taka. Una foto del momento — actualizada cada semana.
        </p>

        <div className="space-y-2">
          {kings.map((r) => {
            const meta = SPORTS_ORDER.find((s) => s.sport === r.sport)
            const delta = r.score_prev != null ? r.score - Number(r.score_prev) : null
            const deltaColor = delta != null && delta >= 0 ? '#22c55e' : '#f87171'
            return (
              <Link key={r.id} href={`/rankings/${r.id}`}
                className="block rounded-xl transition-all hover:brightness-110"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid #C4B5FD',
                  textDecoration: 'none',
                }}>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-lg flex-shrink-0" title={meta?.label}>
                    {meta?.emoji ?? '🏅'}
                  </span>
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.name} width={40} height={40}
                      style={{ borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 10,
                      background: 'rgba(124,58,237,0.18)', flexShrink: 0 }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.15em]"
                      style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}>
                      {meta?.label ?? r.sport}
                    </p>
                    <p className="text-sm font-bold truncate"
                      style={{ color: '#E8E8F0', fontFamily: 'var(--font-sport)' }}>
                      {r.name}
                    </p>
                    {r.subtitle && (
                      <p className="text-[10px] truncate"
                        style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                        {r.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-base font-black tabular-nums"
                      style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
                      {Number(r.score).toFixed(1)}
                    </span>
                    {delta != null && Math.abs(delta) >= 0.1 && (
                      <span className="block text-[9px] tabular-nums"
                        style={{ color: deltaColor, fontFamily: 'var(--font-display)' }}>
                        {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <p className="text-[11px] mt-8 text-center"
          style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
          El score se calcula igual entre deportes. El fútbol domina el top general porque
          tiene más entries (3.000+) y mayor cobertura. Ver{' '}
          <Link href="/rankings/metodologia" style={{ color: '#7C3AED' }}>metodología</Link>.
        </p>
      </div>
    </div>
  )
}
