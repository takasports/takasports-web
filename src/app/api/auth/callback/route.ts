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

      // window.location.replace no añade entrada al historial,
      // evitando el loop al pulsar "atrás" tras el callback OAuth.
      const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/perfil'
      return new NextResponse(
        `<!DOCTYPE html><html><head><script>window.location.replace("${origin}${safeNext}")</script></head><body></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }
  }

  return NextResponse.redirect(`${origin}/perfil?auth_error=callback_failed`)
}
