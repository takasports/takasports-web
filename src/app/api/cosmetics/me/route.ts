// GET /api/cosmetics/me
//
// Devuelve el estado completo del sistema de personalización para el
// usuario logueado:
//
//   · catalog  → catálogo completo de cosmetics activos (DB)
//   · unlocked → ids de cosmetics que el user tiene desbloqueados
//   · equipment → cosmetics actualmente equipados por slot
//
// Pensado para alimentar el futuro vestidor + galería con preview en
// vivo. La galería /badges existente seguirá funcionando (lee solo el
// catálogo de badges en código).
//
// Cache: no-store (datos del user, volátiles tras cualquier unlock/equip).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { fetchUserEquipment, type EquipSlot } from '@/lib/equipment'

export const dynamic = 'force-dynamic'

interface CatalogItem {
  id:               string
  type:             string
  name:             string
  description:      string | null
  rarity:           string
  data:             Record<string, unknown>
  unlock_source:    string
  unlock_condition: Record<string, unknown>
  season:           string | null
  sort_order:       number
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 })
  }

  // Tres lecturas en paralelo
  const [catalogRes, unlockedRes, equipment] = await Promise.all([
    sb.from('cosmetics')
      .select('id, type, name, description, rarity, data, unlock_source, unlock_condition, season, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    sb.from('user_cosmetic_unlocks')
      .select('cosmetic_id, unlocked_at')
      .eq('user_id', user.id),
    fetchUserEquipment(sb, user.id),
  ])

  const catalog: CatalogItem[]   = (catalogRes.data ?? []) as CatalogItem[]
  const unlocked: { cosmetic_id: string; unlocked_at: string }[] = unlockedRes.data ?? []

  // Mapa slot → cosmetic_id equipado (resumen plano para el cliente)
  const equippedBySlot: Partial<Record<EquipSlot, string>> = {}
  for (const slot of Object.keys(equipment) as EquipSlot[]) {
    const val = equipment[slot]
    if (val && 'cosmeticId' in val && val.cosmeticId) {
      equippedBySlot[slot] = val.cosmeticId
    }
  }

  return NextResponse.json({
    catalog,
    unlocked: unlocked.map(u => ({ id: u.cosmetic_id, unlockedAt: u.unlocked_at })),
    equipment,        // shape completa (legacy + cosmetic) lista para render
    equippedBySlot,   // mapa simple slot → cosmetic_id (útil para el vestidor)
    counts: {
      catalog:  catalog.length,
      unlocked: unlocked.length,
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
