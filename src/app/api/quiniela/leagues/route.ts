import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { readJson } from '@/lib/api-utils'
import { captureException } from '@/lib/monitoring'
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
}

// Forma laxa del cuerpo entrante (se valida/sanitiza más abajo campo a campo).
interface CreateLeagueBody {
  name?: unknown
  jornada?: unknown
  matchKeys?: Array<Record<string, unknown>>
}
interface UpdateLeagueBody {
  id?: unknown
  nickname?: unknown
  picks?: unknown
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
  const parsed = await readJson<CreateLeagueBody>(req)
  if ('error' in parsed) return parsed.error
  const body = parsed.data
  try {
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

      // El owner se autoinscribe vacío. Las columnas exact_scores y
      // captain_idx siguen existiendo en la DB (sin borrar para no romper)
      // pero ya no se leen ni se escriben — ligas privadas son por puntos.
      await sb.from('quiniela_league_members').insert({
        league_id: id,
        user_id: user.id,
        nickname: user.email?.split('@')[0]?.slice(0, 24) ?? `User-${user.id.slice(0, 6)}`,
        picks: {},
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
    captureException(e, { route: 'quiniela/leagues' })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
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
      .select('nickname, picks')
      .eq('league_id', id)
    return NextResponse.json({
      id: league.id,
      name: league.name,
      jornada: league.jornada,
      matchKeys: league.match_keys,
      createdAt: league.created_at,
      // AD — expone ownerId y exactEnabled para que la UI sepa
      // (a) si mostrar el toggle (solo si user es owner) y
      // (b) el badge "Con/Sin marcador exacto" para todos los miembros.
      ownerId: (league as { owner_id?: string | null }).owner_id ?? null,
      exactEnabled: (league as { exact_enabled?: boolean }).exact_enabled !== false,
      members: (members ?? []).map(m => ({
        nickname: m.nickname,
        picks: m.picks ?? {},
      })),
    })
  }

  // Fallback in-memory: el toggle real vive en Supabase, así que aquí
  // siempre devolvemos exactEnabled=true (default consistente).
  const mem = memStore.get(id)
  if (!mem) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({
    id: mem.row.id,
    name: mem.row.name,
    jornada: mem.row.jornada,
    matchKeys: mem.row.match_keys,
    createdAt: mem.row.created_at,
    ownerId: mem.row.owner_id,
    exactEnabled: true,
    members: [...mem.members.values()].map(m => ({
      nickname: m.nickname, picks: m.picks,
    })),
  })
}

// ── PATCH: unirse / actualizar picks ────────────────────────────
export async function PATCH(req: NextRequest) {
  const parsed = await readJson<UpdateLeagueBody>(req)
  if ('error' in parsed) return parsed.error
  const body = parsed.data
  try {
    const id = String(body?.id ?? '').toUpperCase()
    // 'Tú' era el placeholder hardcodeado que colapsaba a todos los
    // miembros en una sola fila — lo tratamos como vacío.
    const rawNick = String(body?.nickname ?? '').trim().slice(0, 24)
    const nickname = rawNick.toLowerCase() === 'tú' || rawNick.toLowerCase() === 'tu' ? '' : rawNick
    const rawPicks = sanitizePicks(body?.picks)

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const sb = await createServerSupabaseClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

      // Si el cliente no manda alias válido, derivamos del email — nunca 'Tú'
      const safeNick = nickname || user.email?.split('@')[0]?.slice(0, 24) || `User-${user.id.slice(0, 6)}`

      const { data: league } = await sb
        .from('quiniela_leagues').select('match_keys').eq('id', id).maybeSingle()
      if (!league) return NextResponse.json({ error: 'not found' }, { status: 404 })

      const matchKeys = league.match_keys as LeagueMatchKey[]
      const picks = dropLockedPicks(rawPicks, matchKeys)

      const { error } = await sb.from('quiniela_league_members').upsert({
        league_id: id,
        user_id: user.id,
        nickname: safeNick,
        picks,
      }, { onConflict: 'league_id,user_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ ok: true, locked: Object.keys(rawPicks).length - Object.keys(picks).length })
    }

    // Fallback (sin Supabase): alias o invitado aleatorio, nunca 'Tú'
    const guestNick = nickname || `Invitado-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const mem = memStore.get(id)
    if (!mem) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const picks = dropLockedPicks(rawPicks, mem.row.match_keys)
    mem.members.set(guestNick, {
      league_id: id, user_id: 'anon', nickname: guestNick, picks,
    })
    return NextResponse.json({ ok: true, locked: Object.keys(rawPicks).length - Object.keys(picks).length })
  } catch (e) {
    captureException(e, { route: 'quiniela/leagues' })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
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
    captureException(e, { route: 'quiniela/leagues' })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
