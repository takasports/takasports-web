// Migra datos de localStorage → Supabase cuando el usuario hace login por primera vez.
// Idempotente: no duplica coins si ya se han migrado (usa una marca en user_metadata).
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'

interface MigrateBody {
  coinBalance: number          // saldo actual en localStorage
  badges: string[]             // badge ids ganados
}

const COINS_INITIAL = 100

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, reason: 'supabase not configured' })
  }
  try {
    const body = await req.json() as MigrateBody
    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

    // Evitar doble migración: comprobamos si ya existe alguna transacción para este usuario
    const { count } = await sb
      .from('quiniela_coin_txns')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    const alreadyMigrated = (count ?? 0) > 0

    let coinsAdded = 0
    if (!alreadyMigrated) {
      // Solo migramos la diferencia respecto al saldo inicial (para no regalar monedas gratis)
      const surplus = Math.max(0, (body.coinBalance ?? COINS_INITIAL) - COINS_INITIAL)
      if (surplus > 0) {
        // Cap: máximo 2000 monedas de migración para evitar abuso
        const amount = Math.min(surplus, 2000)
        const admin = adminSupabase()
        if (admin) {
          await admin.rpc('add_coins', {
            p_amount: amount,
            p_reason: 'Migración desde dispositivo anterior',
            p_context: { source: 'localStorage' },
            p_user_id: user.id,
          })
          coinsAdded = amount
        }
      }
    }

    // Migrar badges (upsert idempotente)
    const badges = Array.isArray(body.badges) ? body.badges.filter(b => typeof b === 'string').slice(0, 20) : []
    if (badges.length > 0) {
      await sb.from('quiniela_badges').upsert(
        badges.map(id => ({ user_id: user.id, badge_id: id })),
        { onConflict: 'user_id,badge_id', ignoreDuplicates: true }
      )
    }

    return NextResponse.json({ ok: true, coinsAdded, badgesMigrated: badges.length, alreadyMigrated })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
