// POST /api/admin/badges/special
//
// Endpoint admin para crear o actualizar special badges sin redeploy.
// Protegido por X-Admin-Secret (PUSH_BROADCAST_SECRET reusado).
//
// Body: {
//   badge_id: string         // PK, normalmente con prefijo "sp_"
//   name, emoji, color, bg, description
//   rarity?: 'common' | 'rare' | 'epic' | 'legendary' (default 'rare')
//   jornada?: string         // null = cualquier jornada que matchee criterio
//   criteria_type: 'top_n' | 'min_hits' | 'pleno' | 'all_participants' | 'manual'
//   criteria_value?: number  // default 0
//   max_grants?: number      // default 0 (ilimitado)
//   expires_at?: string      // ISO timestamp
//   active?: boolean         // default true
// }
//
// GET para listar todos los special badges (admin debug).

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { safeEqual } from '@/lib/auth-utils'

interface CreateBody {
  badge_id: string
  name: string
  emoji: string
  color: string
  bg: string
  description: string
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
  jornada?: string | null
  criteria_type: 'top_n' | 'min_hits' | 'pleno' | 'all_participants' | 'manual'
  criteria_value?: number
  max_grants?: number
  expires_at?: string | null
  active?: boolean
}

function assertAuthorized(req: NextRequest): NextResponse | null {
  const required = process.env.PUSH_BROADCAST_SECRET
  if (!required) {
    return NextResponse.json({ error: 'admin endpoint not configured' }, { status: 503 })
  }
  const secret = req.headers.get('x-admin-secret') ?? ''
  if (!safeEqual(secret, required)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return null
}

export async function GET(req: NextRequest) {
  // Solo header x-admin-secret. Query string eliminado: filtraría el secret en logs de Vercel.
  const auth = assertAuthorized(req)
  if (auth) return auth

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'no_supabase' }, { status: 503 })

  const { data, error } = await admin
    .from('quiniela_special_badges')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ badges: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = assertAuthorized(req)
  if (auth) return auth

  let body: CreateBody
  try { body = await req.json() as CreateBody } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }) }

  if (!body.badge_id || !body.name || !body.emoji || !body.color || !body.bg || !body.description || !body.criteria_type) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
  }
  if (!body.badge_id.startsWith('sp_')) {
    return NextResponse.json({ error: 'badge_id must start with sp_ (convention)' }, { status: 400 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'no_supabase' }, { status: 503 })

  const row = {
    badge_id:       body.badge_id,
    name:           body.name,
    emoji:          body.emoji,
    color:          body.color,
    bg:             body.bg,
    description:    body.description,
    rarity:         body.rarity ?? 'rare',
    jornada:        body.jornada ?? null,
    criteria_type:  body.criteria_type,
    criteria_value: body.criteria_value ?? 0,
    max_grants:     body.max_grants ?? 0,
    expires_at:     body.expires_at ?? null,
    active:         body.active ?? true,
  }

  const { error } = await admin
    .from('quiniela_special_badges')
    .upsert(row, { onConflict: 'badge_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, badge_id: body.badge_id })
}
