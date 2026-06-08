// GET /api/ranked/me
// → Devuelve pid (opaco) y display_name del usuario autenticado.
// Usado por UIs que necesitan saber quién soy para resaltar mi fila
// (comparando pid; NO se expone el user_id crudo de auth).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { publicId } from '@/lib/public-id'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ pid: null }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    pid:          publicId(user.id),
    display_name: (profile as { display_name?: string } | null)?.display_name ?? null,
    avatar_url:   (profile as { avatar_url?: string } | null)?.avatar_url ?? null,
  })
}
