// API de búsqueda global cross-categoría
//
// Busca por nombre/subtitle en TODAS las categorías de la vista `ranking_view`.
// Devuelve hasta `limit` entradas con score, categoría, deporte y enlace al perfil.
// Usa la deduplicación por id para no devolver el mismo deportista varias veces
// (un jugador puede aparecer en `jugadores` y `latam`, por ejemplo).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  RANKING_JUGADORES, RANKING_JUGADORAS, RANKING_CLUBES, RANKING_CLUBES_FEMENINO,
  RANKING_ENTRENADORES, RANKING_CREADORES, RANKING_PERIODISTAS, RANKING_LUCHADORAS_UFC,
  RANKING_CREADORES_WWE, RANKING_JUGADORES_SUB21, RANKING_JUGADORES_LATAM, RANKING_JUGADORES_CONCACAF,
  type RankingEntry,
} from '@/lib/rankings'

export const revalidate = 300 // 5 min cache

type SearchHit = {
  id: string
  name: string
  subtitle: string
  sport?: string
  category?: string
  score: number
  rank?: number
  emoji?: string
  image?: string
  country?: string
  badge?: string
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function entryToHit(e: Partial<RankingEntry> & { id: string; name: string; score: number }, category?: string): SearchHit {
  return {
    id: e.id,
    name: e.name,
    subtitle: e.subtitle ?? '',
    sport: e.sport,
    category: category ?? e.category,
    score: e.score,
    rank: e.rank,
    emoji: e.emoji,
    image: e.image,
    country: e.country,
    badge: e.badge,
  }
}

// Fuentes estáticas con su categoría — sirven como fallback y para categorías
// editoriales (creadores/periodistas/wwe) que no están en la vista DB.
const STATIC_SOURCES: { category: string; entries: RankingEntry[] }[] = [
  { category: 'jugadores',       entries: RANKING_JUGADORES },
  { category: 'jugadoras',       entries: RANKING_JUGADORAS },
  { category: 'sub21',           entries: RANKING_JUGADORES_SUB21 },
  { category: 'latam',           entries: RANKING_JUGADORES_LATAM },
  { category: 'concacaf',        entries: RANKING_JUGADORES_CONCACAF },
  { category: 'clubes',          entries: RANKING_CLUBES },
  { category: 'clubes_femenino', entries: RANKING_CLUBES_FEMENINO },
  { category: 'entrenadores',    entries: RANKING_ENTRENADORES },
  { category: 'creadores',       entries: RANKING_CREADORES },
  { category: 'periodistas',     entries: RANKING_PERIODISTAS },
  { category: 'luchadoras_ufc',  entries: RANKING_LUCHADORAS_UFC },
  { category: 'creadores_wwe',   entries: RANKING_CREADORES_WWE },
]

function searchStatic(q: string, limit: number): SearchHit[] {
  const out: SearchHit[] = []
  for (const { category, entries } of STATIC_SOURCES) {
    for (const e of entries) {
      if (norm(e.name).includes(q) || norm(e.subtitle).includes(q)) {
        out.push(entryToHit(e, category))
      }
    }
  }
  // Dedupe por id manteniendo el de mayor score
  const byId = new Map<string, SearchHit>()
  for (const hit of out) {
    const prev = byId.get(hit.id)
    if (!prev || hit.score > prev.score) byId.set(hit.id, hit)
  }
  return Array.from(byId.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const rawQ = (url.searchParams.get('q') ?? '').trim()
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '30', 10) || 30, 1), 100)

  if (rawQ.length < 2) {
    return NextResponse.json({ q: rawQ, hits: [], source: 'empty' })
  }

  const q = norm(rawQ)

  // 1) DB primero (cubre ~13K entries auto)
  if (supabaseConfigured()) {
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      )

      // ilike es case-insensitive en Supabase, pero no quita acentos.
      // Hacemos una query amplia y filtramos en server por nombre normalizado.
      const { data, error } = await sb
        .from('ranking_view')
        .select('id,name,subtitle,sport,category,score,rank,emoji,image_url,country,badge')
        .or(`name.ilike.%${rawQ}%,subtitle.ilike.%${rawQ}%`)
        .order('score', { ascending: false })
        .limit(500)

      if (!error && data && data.length > 0) {
        const dbHits: SearchHit[] = data
          .filter((r) => norm(r.name ?? '').includes(q) || norm(r.subtitle ?? '').includes(q))
          .map((r) => ({
            id:       r.id,
            name:     r.name,
            subtitle: r.subtitle ?? '',
            sport:    r.sport ?? undefined,
            category: r.category ?? undefined,
            score:    Number(r.score ?? 0),
            rank:     r.rank ?? undefined,
            emoji:    r.emoji ?? undefined,
            image:    r.image_url ?? undefined,
            country:  r.country ?? undefined,
            badge:    r.badge ?? undefined,
          }))

        // Merge con estáticos (cubre creadores/periodistas/wwe que no van a DB)
        const staticHits = searchStatic(q, limit)
        const byId = new Map<string, SearchHit>()
        for (const h of [...dbHits, ...staticHits]) {
          const prev = byId.get(h.id)
          if (!prev || h.score > prev.score) byId.set(h.id, h)
        }
        const merged = Array.from(byId.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
        return NextResponse.json({ q: rawQ, hits: merged, source: 'db+static', total: merged.length })
      }
    } catch {
      // cae al estático
    }
  }

  // 2) Fallback estático
  const hits = searchStatic(q, limit)
  return NextResponse.json({ q: rawQ, hits, source: 'static', total: hits.length })
}
