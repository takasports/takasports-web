// GET /api/ranked/me
// → Devuelve user_id y display_name del usuario autenticado.
// Usado por UIs que necesitan saber quién soy para resaltar mi fila.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { publicId } from '@/lib/public-id'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ user_id: null }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    pid:          publicId(user.id),
    user_id:      user.id,
    display_name: (profile as { display_name?: string } | null)?.display_name ?? null,
    avatar_url:   (profile as { avatar_url?: string } | null)?.avatar_url ?? null,
  })
}
