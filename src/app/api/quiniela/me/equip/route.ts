// POST /api/quiniela/me/equip
//
// Equipa un item (badge legacy o cosmetic nuevo) en un slot de
// personalización del user logueado. El equipamiento es público y
// visible en el ranking de todos.
//
// Body (uno de los dos modos):
//
//   Legacy (badges en código):
//     { slot: 'badge'|'title'|'frame'|'card_bg', badgeId: string|null }
//
//   Nuevo (cosmetics en DB):
//     { slot: <cualquiera de los 9>, cosmeticId: string|null }
//
// Validaciones:
//   Legacy → user debe poseer el badge, y el badge debe proveer el slot
//            (según unlocks por rareza).
//   Cosmetic → user debe tener el cosmetic en user_cosmetic_unlocks,
//              y cosmetic.type debe matchear el slot.
//
// Para desequipar: pasa `badgeId: null` o `cosmeticId: null`.
//
// Mutuamente excluyente: una request setea badgeId O cosmeticId, no
// ambos (el CHECK exactly-one en DB lo enforza también).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { BADGES } from '@/lib/badges'
import {
  validateEquip, validateCosmeticEquip,
  type EquipSlot, EQUIP_SLOTS,
} from '@/lib/equipment'

interface EquipBody {
  slot:        EquipSlot
  badgeId?:    string | null
  cosmeticId?: string | null
}

export async function POST(req: NextRequest) {
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  let body: EquipBody
  try { body = await req.json() as EquipBody } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!EQUIP_SLOTS.includes(body.slot)) {
    return NextResponse.json({ error: 'invalid slot' }, { status: 400 })
  }

  const hasBadge    = body.badgeId !== undefined
  const hasCosmetic = body.cosmeticId !== undefined

  if (hasBadge && hasCosmetic) {
    return NextResponse.json(
      { error: 'pasa badgeId O cosmeticId, no ambos' },
      { status: 400 },
    )
  }
  if (!hasBadge && !hasCosmetic) {
    return NextResponse.json(
      { error: 'badgeId o cosmeticId requerido' },
      { status: 400 },
    )
  }

  // ── DESEQUIPAR (cualquier campo a null) ──────────────────────────
  if ((hasBadge && body.badgeId === null) || (hasCosmetic && body.cosmeticId === null)) {
    await sb
      .from('quiniela_user_equipment')
      .delete()
      .eq('user_id', user.id)
      .eq('slot', body.slot)
    return NextResponse.json({ ok: true, slot: body.slot, equipped: null })
  }

  // ── MODO LEGACY (badgeId) ────────────────────────────────────────
  if (hasBadge && body.badgeId) {
    const badgeDef = BADGES[body.badgeId]
    if (!badgeDef) {
      return NextResponse.json({ error: 'badge desconocido' }, { status: 404 })
    }

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

    // Upsert con cosmetic_id explícitamente null (mutuamente excluyente)
    const { error } = await sb
      .from('quiniela_user_equipment')
      .upsert(
        {
          user_id: user.id, slot: body.slot,
          badge_id: body.badgeId, cosmetic_id: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,slot' },
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true, slot: body.slot,
      equipped: { source: 'badge', id: body.badgeId },
    })
  }

  // ── MODO COSMETIC (cosmeticId) ───────────────────────────────────
  if (hasCosmetic && body.cosmeticId) {
    // Fetch cosmetic + unlock en paralelo
    const [cosmeticRes, unlockRes] = await Promise.all([
      sb.from('cosmetics')
        .select('id, type, name, active')
        .eq('id', body.cosmeticId)
        .eq('active', true)
        .maybeSingle(),
      sb.from('user_cosmetic_unlocks')
        .select('cosmetic_id')
        .eq('user_id', user.id)
        .eq('cosmetic_id', body.cosmeticId)
        .maybeSingle(),
    ])

    if (!cosmeticRes.data) {
      return NextResponse.json({ error: 'cosmetic desconocido o inactivo' }, { status: 404 })
    }
    const cosmetic = cosmeticRes.data as { id: string; type: string }

    const ownedSet = unlockRes.data ? new Set([body.cosmeticId]) : new Set<string>()
    const validErr = validateCosmeticEquip(body.slot, cosmetic.type, body.cosmeticId, ownedSet)
    if (validErr) {
      return NextResponse.json({ error: validErr }, { status: 422 })
    }

    // Upsert con badge_id explícitamente null
    const { error } = await sb
      .from('quiniela_user_equipment')
      .upsert(
        {
          user_id: user.id, slot: body.slot,
          badge_id: null, cosmetic_id: body.cosmeticId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,slot' },
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true, slot: body.slot,
      equipped: { source: 'cosmetic', id: body.cosmeticId },
    })
  }

  return NextResponse.json({ error: 'unreachable' }, { status: 500 })
}
