// Balance + historial de monedas del usuario autenticado.
// Sin sesión devuelve { balance: null, txns: [] } para que el cliente
// sepa que debe usar localStorage como fallback (modo invitado).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ balance: null, txns: [] })
  }
  try {
    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ balance: null, txns: [] })

    const [balRes, txnsRes] = await Promise.all([
      sb.from('quiniela_coin_balance').select('balance').eq('user_id', user.id).maybeSingle(),
      sb.from('quiniela_coin_txns')
        .select('amount,reason,context,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    return NextResponse.json({
      balance: balRes.data?.balance ?? 0,
      txns: txnsRes.data ?? [],
    })
  } catch (e) {
    return NextResponse.json({ balance: null, txns: [], error: String(e) }, { status: 200 })
  }
}
