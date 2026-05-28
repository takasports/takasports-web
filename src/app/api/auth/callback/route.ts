import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { awardBadges } from '@/lib/badge-awards'
import { WELCOME_BADGE_IDS } from '@/lib/badges'

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
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Nombre de display: proveedor OAuth → email prefix como fallback
        const providerName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined
        const emailPrefix   = user.email?.split('@')[0] ?? null
        const displayName   = providerName ?? emailPrefix

        // Detectar si es usuario nuevo (perfil no existe todavía)
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('id', user.id)
        const isNew = count === 0

        await supabase.from('profiles').upsert({
          id:           user.id,
          display_name: displayName,
          avatar_url:   user.user_metadata?.avatar_url ?? null,
          timezone:     'Europe/Madrid',
        }, { onConflict: 'id', ignoreDuplicates: true })

        // Badge de bienvenida aleatorio para nuevos usuarios
        if (isNew) {
          const welcomeId = WELCOME_BADGE_IDS[Math.floor(Math.random() * WELCOME_BADGE_IDS.length)]
          await awardBadges(supabase, user.id, [welcomeId])
        }
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
