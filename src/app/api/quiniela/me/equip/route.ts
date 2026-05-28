// POST /api/quiniela/me/equip
//
// Equipa un badge en un slot de personalización del user logueado.
// El equipamiento es público y visible en el ranking de todos.
//
// Body: { slot: 'badge'|'title'|'frame'|'card_bg', badgeId: string }
//
// Validaciones:
//   · User debe poseer el badge (row en quiniela_badges).
//   · El badge debe proveer el ítem para ese slot (unlocks según rareza).
//   · Un slot con el mismo badge_id ya equipado → 200 sin re-upsert.
//
// Para desequipar (quitar sin poner otro):
//   Body: { slot, badgeId: null }

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { BADGES } from '@/lib/badges'
import { validateEquip, type EquipSlot, EQUIP_SLOTS } from '@/lib/equipment'

interface EquipBody {
  slot: EquipSlot
  badgeId: string | null
}

export async function POST(req: NextRequest) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  let body: EquipBody
  try { body = await req.json() as EquipBody } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!EQUIP_SLOTS.includes(body.slot)) {
    return NextResponse.json({ error: 'invalid slot' }, { status: 400 })
  }

  // Desequipar
  if (body.badgeId === null) {
    await sb
      .from('quiniela_user_equipment')
      .delete()
      .eq('user_id', user.id)
      .eq('slot', body.slot)
    return NextResponse.json({ ok: true, slot: body.slot, badgeId: null })
  }

  // Validar badge en catálogo
  const badgeDef = BADGES[body.badgeId]
  if (!badgeDef) {
    return NextResponse.json({ error: 'badge desconocido' }, { status: 404 })
  }

  // Validar que el user posee el badge
  const { data: owned } = await sb
    .from('quiniela_badges')
    .select('badge_id')
    .eq('user_id', user.id)
    .eq('badge_id', body.badgeId)
    .maybeSingle()

  const ownedSet = owned ? new Set([body.badgeId]) : new Set<string>()
  const validErr = validateEquip(body.slot, badgeDef, ownedSet)
  if (validErr) {
    return NextResponse.json({ error: validErr }, { status: 422 })
  }

  // Upsert el slot
  const { error } = await sb
    .from('quiniela_user_equipment')
    .upsert(
      { user_id: user.id, slot: body.slot, badge_id: body.badgeId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,slot' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, slot: body.slot, badgeId: body.badgeId })
}
