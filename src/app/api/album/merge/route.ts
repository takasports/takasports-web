// Álbum de cracks — fusión del álbum LOCAL al iniciar sesión.
//   POST { entries: AlbumEntry[] } → sube sin duplicar (RPC album_merge:
//   mayor recuento, unión de fuentes, primera fecha más antigua).
//
// Lo llama el cliente UNA vez, cuando un invitado con álbum local entra en su
// cuenta, para no perder lo coleccionado sin sesión.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { readJson, apiError } from '@/lib/api-utils'
import { captureException } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'

// Tope defensivo: el catálogo real ronda los cientos de jugadores.
const MAX_MERGE = 2000

export async function POST(req: NextRequest) {
  const parsed = await readJson<{ entries?: unknown }>(req)
  if ('error' in parsed) return parsed.error
  const raw = Array.isArray(parsed.data.entries) ? parsed.data.entries : []
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return apiError('not_configured', 503)
    }
    const { supabase: sb, user } = await supabaseForRequest(req)
    if (!user) return apiError('auth_required', 401)

    // Sanea a solo los campos esperados (el RPC ignora extras, pero no pasamos
    // basura ni payloads gigantes).
    const entries = raw
      .slice(0, MAX_MERGE)
      .map((e) => {
        const o = e as Record<string, unknown>
        return {
          playerId: typeof o.playerId === 'string' ? o.playerId : null,
          firstSeen: typeof o.firstSeen === 'string' ? o.firstSeen : null,
          count: typeof o.count === 'number' ? o.count : 1,
          sources: Array.isArray(o.sources) ? o.sources.filter((s) => typeof s === 'string') : [],
        }
      })
      .filter((e) => e.playerId)

    if (entries.length === 0) return NextResponse.json({ ok: true, merged: 0 })

    const { error } = await sb.rpc('album_merge', { p_entries: entries })
    if (error) {
      captureException(error, { route: 'album/merge:POST' })
      return apiError('server_error', 500)
    }
    return NextResponse.json({ ok: true, merged: entries.length })
  } catch (e) {
    captureException(e, { route: 'album/merge:POST' })
    return apiError('server_error', 500)
  }
}
