import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { findEntryByIdFromDb } from '@/lib/rankings-data'
import { findEntryById } from '@/lib/rankings-search'
import type { RankingEntry } from '@/lib/rankings'
import RankRow from '@/components/rankings/RankRow'

export const metadata: Metadata = {
  title: 'Mi Top · Índice Taka',
  description: 'Tu watchlist personal del Índice Taka — los deportistas, clubes y creadores que sigues.',
}

export const dynamic = 'force-dynamic'

export default async function MiTopPage() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?returnTo=/rankings/mi-top')

  const { data: favs } = await sb
    .from('user_favorites')
    .select('entry_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const entries: RankingEntry[] = []
  for (const f of favs ?? []) {
    const e = (await findEntryByIdFromDb(f.entry_id)) ?? findEntryById(f.entry_id)
    if (e) entries.push(e)
  }
  entries.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

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
          Mi <span style={{ color: '#f87171' }}>Top</span>
        </h1>
        <p className="text-sm mb-8" style={{ color: '#8E8E9E', fontFamily: 'var(--font-sport)' }}>
          {entries.length === 0
            ? 'Aún no sigues a nadie. Toca el ❤ en cualquier entry del Índice para añadirlo aquí.'
            : `Sigues a ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} del Índice. Reordenado por score actual.`}
        </p>

        {entries.length === 0 ? (
          <Link href="/rankings"
            className="inline-block px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
            style={{
              background: 'rgba(124,58,237,0.15)',
              color: '#C4B5FD',
              border: '1px solid rgba(124,58,237,0.4)',
              fontFamily: 'var(--font-sport)',
            }}>
            Explorar el Índice →
          </Link>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <RankRow key={e.id} entry={e} showSportEmoji />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
