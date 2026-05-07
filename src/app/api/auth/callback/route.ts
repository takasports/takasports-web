import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/perfil'
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/perfil?auth_error=${encodeURIComponent(error)}`)
  }

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      // Upsert profile row on first sign-in
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').upsert({
          id:           user.id,
          display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
          avatar_url:   user.user_metadata?.avatar_url ?? null,
          timezone:     'Europe/Madrid',
        }, { onConflict: 'id', ignoreDuplicates: true })
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/perfil?auth_error=callback_failed`)
}
