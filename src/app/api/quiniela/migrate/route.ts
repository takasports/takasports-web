// Migra badges de localStorage → Supabase cuando el usuario hace login.
// (La migración de "monedas" se retiró con el modelo sin monedas; el
//  modo invitado ya no acumula saldo que migrar.)
// Idempotente: badges upsert con ignoreDuplicates.
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface MigrateBody {
  badges: string[]             // badge ids ganados como invitado (localStorage)
}

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, reason: 'supabase not configured' })
  }
  try {
    const body = await req.json() as MigrateBody
    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

    // Migrar badges (upsert idempotente)
    const badges = Array.isArray(body.badges)
      ? body.badges.filter(b => typeof b === 'string').slice(0, 20)
      : []
    if (badges.length > 0) {
      await sb.from('quiniela_badges').upsert(
        badges.map(id => ({ user_id: user.id, badge_id: id })),
        { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
      )
    }

    return NextResponse.json({ ok: true, badgesMigrated: badges.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
