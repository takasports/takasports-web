import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import type { Pick } from '@/lib/quiniela'

// Estructura de un partido referenciado en una liga (snapshot al crearla)
interface LeagueMatchKey {
  home: string
  away: string
  isoDate?: string   // requerido para validación de cierre server-side
  espnId?: string
}

interface LeagueRow {
  id: string
  name: string
  jornada: string
  match_keys: LeagueMatchKey[]
  owner_id: string | null
  created_at: string
}

interface MemberRow {
  league_id: string
  user_id: string
  nickname: string
  picks: Record<string, Pick>
  exact_scores: Record<string, { home: number; away: number }>
  captain_idx: number | null
}

// ── Fallback in-memory (solo si Supabase no está configurado) ──────
interface MemEntry { row: LeagueRow; members: Map<string, MemberRow> }
const memStore = new Map<string, MemEntry>()

function genCode(existing: (id: string) => boolean): string {
  for (let i = 0; i < 20; i++) {
    const c = Math.random().toString(36).slice(2, 8).toUpperCase()
    if (!existing(c)) return c
  }
  // colisión extrema: timestamp suffix
  return Math.random().toString(36).slice(2, 5).toUpperCase() + Date.now().toString(36).slice(-3).toUpperCase()
}

// Sanitiza un objeto de picks: solo claves numéricas, valores válidos.
const VALID_PICKS = new Set(['1', 'X', '2', '1X', 'X2'])
function sanitizePicks(input: unknown): Record<string, Pick> {
  if (!input || typeof input !== 'object') return {}
  const out: Record<string, Pick> = {}
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!/^\d+$/.test(k)) continue
    if (typeof v !== 'string' || !VALID_PICKS.has(v)) continue
    out[k] = v as Pick
  }
  return out
}

function sanitizeExact(input: unknown): Record<string, { home: number; away: number }> {
  if (!input || typeof input !== 'object') return {}
  const out: Record<string, { home: number; away: number }> = {}
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!/^\d+$/.test(k)) continue
    if (!v || typeof v !== 'object') continue
    const obj = v as Record<string, unknown>
    const h = Number(obj.home), a = Number(obj.away)
    if (Number.isInteger(h) && Number.isInteger(a) && h >= 0 && a >= 0 && h <= 20 && a <= 20) {
      out[k] = { home: h, away: a }
    }
  }
  return out
}

// Filtra picks dejando fuera los partidos cuyo kickoff ya empezó.
function dropLockedPicks<T extends Record<string, unknown>>(
  picks: T, matchKeys: LeagueMatchKey[], graceSeconds = 0,
): T {
  const now = Date.now()
  const cleaned: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(picks)) {
    const idx = Number(k)
    const m = matchKeys[idx]
    if (!m) continue
    if (m.isoDate) {
      const k2 = new Date(m.isoDate).getTime()
      if (!Number.isNaN(k2) && k2 - graceSeconds * 1000 <= now) continue
    }
    cleaned[k] = v
  }
  return cleaned as T
}

// ── POST: crear liga ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim().slice(0, 60)
    const jornada = String(body?.jornada ?? '').trim().slice(0, 80)
    const matchKeysRaw = Array.isArray(body?.matchKeys) ? body.matchKeys : []
    if (!jornada) return NextResponse.json({ error: 'jornada required' }, { status: 400 })
    if (matchKeysRaw.length === 0 || matchKeysRaw.length > 50) {
      return NextResponse.json({ error: 'matchKeys: 1..50 required' }, { status: 400 })
    }
    const matchKeys: LeagueMatchKey[] = matchKeysRaw.map((m: Record<string, unknown>) => ({
      home: String(m.home ?? '').slice(0, 80),
      away: String(m.away ?? '').slice(0, 80),
      isoDate: m.isoDate ? String(m.isoDate).slice(0, 40) : undefined,
      espnId:  m.espnId  ? String(m.espnId).slice(0, 40)  : undefined,
    })).filter((m: LeagueMatchKey) => m.home && m.away)

    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()

    // ── Path Supabase ────────────────────────────────────────────
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && user) {
      // Generar código no colisionado
      let id = ''
      for (let i = 0; i < 20; i++) {
        const c = Math.random().toString(36).slice(2, 8).toUpperCase()
        const { data: existing } = await sb.from('quiniela_leagues').select('id').eq('id', c).maybeSingle()
        if (!existing) { id = c; break }
      }
      if (!id) return NextResponse.json({ error: 'code collision' }, { status: 500 })

      const { error } = await sb.from('quiniela_leagues').insert({
        id,
        name: name || `Liga ${id}`,
        jornada,
        match_keys: matchKeys,
        owner_id: user.id,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // El owner se autoinscribe vacío
      await sb.from('quiniela_league_members').insert({
        league_id: id,
        user_id: user.id,
        nickname: user.email?.split('@')[0]?.slice(0, 24) ?? `User-${user.id.slice(0, 6)}`,
        picks: {}, exact_scores: {}, captain_idx: null,
      })

      return NextResponse.json({ id, name: name || `Liga ${id}` })
    }

    // ── Path fallback in-memory (sin auth o sin Supabase) ────────
    const id = genCode(c => memStore.has(c))
    const row: LeagueRow = {
      id,
      name: name || `Liga ${id}`,
      jornada,
      match_keys: matchKeys,
      owner_id: null,
      created_at: new Date().toISOString(),
    }
    memStore.set(id, { row, members: new Map() })
    return NextResponse.json({ id, name: row.name })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}

// ── GET: leer liga por id ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.toUpperCase()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const sb = await createServerSupabaseClient()
    const { data: league, error } = await sb
      .from('quiniela_leagues').select('*').eq('id', id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!league) {
      // intentar fallback memoria
      const mem = memStore.get(id)
      if (!mem) return NextResponse.json({ error: 'not found' }, { status: 404 })
      return NextResponse.json({ ...mem.row, members: [...mem.members.values()] })
    }
    const { data: members } = await sb
      .from('quiniela_league_members')
      .select('nickname, picks, exact_scores, captain_idx')
      .eq('league_id', id)
    return NextResponse.json({
      id: league.id,
      name: league.name,
      jornada: league.jornada,
      matchKeys: league.match_keys,
      createdAt: league.created_at,
      members: (members ?? []).map(m => ({
        nickname: m.nickname,
        picks: m.picks ?? {},
        exactScores: m.exact_scores ?? {},
        captainIdx: m.captain_idx,
      })),
    })
  }

  // Fallback
  const mem = memStore.get(id)
  if (!mem) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({
    id: mem.row.id,
    name: mem.row.name,
    jornada: mem.row.jornada,
    matchKeys: mem.row.match_keys,
    createdAt: mem.row.created_at,
    members: [...mem.members.values()].map(m => ({
      nickname: m.nickname, picks: m.picks, exactScores: m.exact_scores, captainIdx: m.captain_idx,
    })),
  })
}

// ── PATCH: unirse / actualizar picks ────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const id = String(body?.id ?? '').toUpperCase()
    const nickname = String(body?.nickname ?? '').trim().slice(0, 24)
    const rawPicks = sanitizePicks(body?.picks)
    const rawExact = sanitizeExact(body?.exactScores)
    const captainIdxRaw = body?.captainIdx
    const captainIdx =
      Number.isInteger(captainIdxRaw) && captainIdxRaw >= 0 && captainIdxRaw < 50
        ? captainIdxRaw : null

    if (!id || !nickname) {
      return NextResponse.json({ error: 'id and nickname required' }, { status: 400 })
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const sb = await createServerSupabaseClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

      const { data: league } = await sb
        .from('quiniela_leagues').select('match_keys').eq('id', id).maybeSingle()
      if (!league) return NextResponse.json({ error: 'not found' }, { status: 404 })

      const matchKeys = league.match_keys as LeagueMatchKey[]
      const picks = dropLockedPicks(rawPicks, matchKeys)
      const exact = dropLockedPicks(rawExact, matchKeys)

      // Capitán: si el partido del capitán ya empezó, descartamos
      let captain: number | null = captainIdx
      if (captain != null) {
        const m = matchKeys[captain]
        if (m?.isoDate && new Date(m.isoDate).getTime() <= Date.now()) captain = null
      }

      const { error } = await sb.from('quiniela_league_members').upsert({
        league_id: id,
        user_id: user.id,
        nickname,
        picks,
        exact_scores: exact,
        captain_idx: captain,
      }, { onConflict: 'league_id,user_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ ok: true, locked: Object.keys(rawPicks).length - Object.keys(picks).length })
    }

    // Fallback
    const mem = memStore.get(id)
    if (!mem) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const picks = dropLockedPicks(rawPicks, mem.row.match_keys)
    const exact = dropLockedPicks(rawExact, mem.row.match_keys)
    let captain: number | null = captainIdx
    if (captain != null) {
      const m = mem.row.match_keys[captain]
      if (m?.isoDate && new Date(m.isoDate).getTime() <= Date.now()) captain = null
    }
    mem.members.set(nickname, {
      league_id: id, user_id: 'anon', nickname,
      picks, exact_scores: exact, captain_idx: captain,
    })
    return NextResponse.json({ ok: true, locked: Object.keys(rawPicks).length - Object.keys(picks).length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}

// ── DELETE: salir de la liga / borrar liga (owner) ──────────────
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')?.toUpperCase()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const sb = await createServerSupabaseClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

      const { data: league } = await sb
        .from('quiniela_leagues').select('owner_id').eq('id', id).maybeSingle()
      if (!league) return NextResponse.json({ error: 'not found' }, { status: 404 })

      if (league.owner_id === user.id) {
        // Owner: borra la liga (cascade borra miembros)
        const { error } = await sb.from('quiniela_leagues').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        // Miembro: solo se borra a sí mismo
        const { error } = await sb.from('quiniela_league_members')
          .delete().eq('league_id', id).eq('user_id', user.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    const mem = memStore.get(id)
    if (!mem) return NextResponse.json({ error: 'not found' }, { status: 404 })
    memStore.delete(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
