import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Top global · Índice Taka',
  description: 'El top global del deporte hispano — jugadores, clubes, entrenadores y creadores ordenados con peso por deporte.',
}

export const revalidate = 1800

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

async function loadTop(limit = 50): Promise<Row[]> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  // El `rank` de la vista ya incluye los boosts aditivos de diversidad por
  // sport (Antonelli/Sinner/SGA/Jones compiten con futbolistas en el top global).
  // Sacamos top de cada categoría y mezclamos por rank.
  const cats = ['jugadores', 'jugadoras', 'clubes', 'entrenadores', 'creadores', 'periodistas']
  const fetches = cats.map(c =>
    sb.from('ranking_view')
      .select('id,name,subtitle,sport,category,score,rank,image_url,score_prev')
      .eq('category', c)
      .order('rank', { ascending: true })
      .range(0, 49)
      .then(({ data }) => (data ?? []) as Row[]),
  )
  const lists = await Promise.all(fetches)
  const all = lists.flat()
  const seen = new Set<string>()
  const rows: Row[] = []
  for (const r of all.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    rows.push(r)
    if (rows.length >= limit) break
  }
  return rows
}

const CATEGORY_LABEL: Record<string, string> = {
  jugadores: 'Jugador', jugadoras: 'Jugadora', clubes: 'Club',
  entrenadores: 'Entrenador', creadores: 'Creador', periodistas: 'Periodista',
}

export default async function TopGlobalPage() {
  const rows = await loadTop(50)
  return (
    <main style={{ background: 'var(--bg-base)', minHeight: '100vh', padding: '24px 16px 80px' }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/rankings"
          className="inline-block text-[10px] font-black uppercase tracking-[0.2em] mb-3"
          style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}>
          ← Volver al Índice
        </Link>
        <h1 className="text-3xl font-black mb-1"
          style={{ color: '#E8E8F0', fontFamily: 'var(--font-display)' }}>
          Top <span style={{ color: '#C4B5FD' }}>50 global</span>
        </h1>
        <p className="text-sm mb-6" style={{ color: '#8E8E9E', fontFamily: 'var(--font-sport)' }}>
          Todo el deporte hispano en una sola lista. Score ponderado por deporte —
          ver <Link href="/rankings/metodologia" style={{ color: '#7C3AED' }}>metodología</Link>.
        </p>

        <div className="space-y-2">
          {rows.map((r, i) => {
            const delta = r.score_prev != null ? r.score - Number(r.score_prev) : null
            const deltaColor = delta != null && delta >= 0 ? '#22c55e' : '#f87171'
            return (
              <Link key={r.id} href={`/rankings/${r.id}`}
                className="block rounded-xl transition-all hover:brightness-110"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderLeft: i < 3 ? '3px solid #C4B5FD' : '3px solid #3A3A52',
                  textDecoration: 'none',
                }}>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-black tabular-nums text-base w-7 text-center flex-shrink-0"
                    style={{ fontFamily: 'var(--font-display)', color: i < 3 ? '#C4B5FD' : '#5A5A72' }}>
                    {i + 1}
                  </span>
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.name} width={36} height={36}
                      style={{ borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: 10,
                      background: 'rgba(124,58,237,0.18)', flexShrink: 0 }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate"
                      style={{ color: '#E8E8F0', fontFamily: 'var(--font-sport)' }}>
                      {r.name}
                    </p>
                    <p className="text-[10px] truncate"
                      style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                      <span style={{ color: '#7C3AED' }}>{CATEGORY_LABEL[r.category] ?? r.category}</span>
                      {r.sport ? ' · ' + r.sport : ''}
                      {r.subtitle ? ' · ' + r.subtitle : ''}
                    </p>
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
      </div>
    </main>
  )
}
