'use client'

import { useEffect } from 'react'
import { trackArticleView } from '@/lib/analytics'
import { createClient } from '@/lib/supabase'

export const RECENTLY_READ_KEY = 'ts_recently_read'
const MAX_ITEMS = 10

export interface ReadItem {
  slug: string
  title: string
  sport?: string
  category?: string
  publishedAt?: string
  imageUrl?: string
}

export default function ReadTracker({ item }: { item: ReadItem }) {
  useEffect(() => {
    trackArticleView({ title: item.title, slug: item.slug, sport: item.sport, category: item.category })
    try {
      const existing: ReadItem[] = JSON.parse(localStorage.getItem(RECENTLY_READ_KEY) ?? '[]')
      const filtered = existing.filter(r => r.slug !== item.slug)
      const updated = [item, ...filtered].slice(0, MAX_ITEMS)
      localStorage.setItem(RECENTLY_READ_KEY, JSON.stringify(updated))
    } catch { /* ignore */ }

    // Si hay sesión, persiste también en la nube (best-effort, no bloquea).
    // getSession() lee la cookie local sin ir al servidor; el endpoint revalida.
    const supabase = createClient()
    supabase?.auth.getSession().then(({ data }) => {
      if (!data.session) return
      fetch('/api/account/sync/reads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [item] }),
      }).catch(() => { /* best-effort */ })
    }).catch(() => { /* ignore */ })
  }, [item.slug])

  return null
}
