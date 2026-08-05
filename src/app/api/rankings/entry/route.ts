// Alta y retirada de fichas del ranking desde el panel.
//
//   POST   /api/rankings/entry    — publica una ficha investigada
//   DELETE /api/rankings/entry    — retira a alguien (suppressed)
//
// ── POR QUÉ `suppressed` Y NO BORRAR ─────────────────────────────
// Borrar una fila no sirve: los ingestores la vuelven a sembrar a la semana
// siguiente y la persona reaparece. `suppressed` (migración 116) es retirada
// editorial permanente — `active` lo gobierna curate-active-entries y lo
// recalcula cada domingo; `suppressed` no lo toca nadie.
//
// Auth: cabecera `x-admin-token` = RANKINGS_ADMIN_TOKEN, o sesión admin.

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { adminSupabase } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/admin-auth'
import { apiError } from '@/lib/api-utils'
import { limpiaHandle, type Handles } from '@/lib/creator-research'

const CATEGORIAS_CONTENIDO = ['creadores', 'creadores_wwe', 'periodistas'] as const
const DEPORTES: Record<string, string> = {
  futbol: 'Fútbol', baloncesto: 'Baloncesto', tenis: 'Tenis',
  formula1: 'Fórmula 1', ufc: 'UFC', wwe: 'WWE',
}

const auth = (req: NextRequest) =>
  isAdminRequest(req, { headerName: 'x-admin-token', tokenEnv: process.env.RANKINGS_ADMIN_TOKEN })

// Identificador legible y estable a partir del nombre. Se comprueba que no
// exista antes de usarlo: la PK es (id, category) y una colisión silenciosa
// sobrescribiría a otra persona.
function slugDe(nombre: string): string {
  return nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 48)
}

export async function POST(req: NextRequest) {
  if (!(await auth(req))) return apiError('No autorizado', 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('Cuerpo JSON inválido', 400)
  }

  const nombre = String(body.nombre ?? '').trim()
  const sport = String(body.sport ?? '').trim()
  const category = String(body.category ?? 'creadores')
  if (!nombre) return apiError('Falta el nombre', 400)
  if (!DEPORTES[sport]) return apiError(`Deporte no reconocido: ${sport}`, 400)
  if (!(CATEGORIAS_CONTENIDO as readonly string[]).includes(category)) {
    return apiError(`Categoría no válida: ${category}`, 400)
  }

  const sb = adminSupabase()
  if (!sb) return apiError('Supabase no configurado', 500)
  const handles = (body.handles ?? {}) as Handles
  const metricas = (body.metricas ?? {}) as Record<string, number | null>

  // Id libre: si el slug ya existe en esa categoría se le añade sufijo, en vez
  // de pisar la ficha de quien ya estaba.
  const base = slugDe(nombre)
  let id = base
  for (let i = 2; i <= 20; i++) {
    const { data } = await sb.from('ranking_entries').select('id').eq('id', id).eq('category', category).maybeSingle()
    if (!data) break
    id = `${base}-${i}`
  }

  // El subtítulo NO lleva cifras de seguidores: los números metidos en texto se
  // fosilizan y acaban mintiendo (ya pasó con la posición de liga en clubes).
  const plataforma = handles.youtube ? 'YouTube' : handles.tiktok ? 'TikTok' : handles.instagram ? 'Instagram' : null
  const { error: errAlta } = await sb.from('ranking_entries').insert({
    id, category, name: nombre, sport,
    subtitle: `${DEPORTES[sport]}${plataforma ? ` · ${plataforma}` : ''}`,
    country: (body.country as string) || null,
    emoji: '🎬',
    image_url: (body.imagen as string) || null,
    handles,
    active: true, featured: false, suppressed: false,
  })
  if (errAlta) return apiError(`No se pudo crear la ficha: ${errAlta.message}`, 500)

  const { error: errMet } = await sb.from('creator_raw_metrics').upsert(
    {
      creator_id: id,
      yt_subscribers: metricas.yt_subscribers ?? 0,
      tiktok_known: metricas.tiktok_known ?? 0,
      instagram_known: metricas.instagram_known ?? 0,
      twitter_known: metricas.twitter_known ?? 0,
      twitch_known: metricas.twitch_known ?? 0,
      videos_last_30d: metricas.videos_last_30d ?? null,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'creator_id' },
  )
  if (errMet) return apiError(`Ficha creada pero sin métricas: ${errMet.message}`, 500)

  // Instagram necesita navegador → se encarga al Mac (migración 119).
  let encargado: string | null = null
  const ig = limpiaHandle(handles.instagram)
  if (ig) {
    const { error } = await sb.from('ranking_research_jobs').insert({
      entry_id: id, category, red: 'instagram', handle: ig,
    })
    // Si ya había un encargo vivo, el índice único lo rechaza y está bien: no
    // hace falta encolarlo dos veces.
    if (!error) encargado = ig
  }

  // La nota la calcula la base, no el cliente: así el panel y el pipeline no
  // pueden discrepar.
  await sb.rpc('f_sync_creator_scores')
  await sb.rpc('refresh_ranking_view')

  const { data: creada } = await sb
    .from('ranking_view')
    .select('id, name, score, rank, category')
    .eq('id', id).eq('category', category).maybeSingle()

  revalidatePath('/rankings')
  revalidatePath(`/rankings/${id}`)
  return NextResponse.json({ ok: true, id, entry: creada, encargadoInstagram: encargado })
}

export async function DELETE(req: NextRequest) {
  if (!(await auth(req))) return apiError('No autorizado', 401)

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const category = searchParams.get('category')
  const deshacer = searchParams.get('deshacer') === '1'
  if (!id || !category) return apiError('Faltan id y category', 400)

  const sb = adminSupabase()
  if (!sb) return apiError('Supabase no configurado', 500)
  const { error } = await sb
    .from('ranking_entries')
    .update(deshacer ? { suppressed: false } : { suppressed: true, active: false })
    .eq('id', id).eq('category', category)   // PK compuesta: SIEMPRE las dos
  if (error) return apiError(`No se pudo ${deshacer ? 'readmitir' : 'retirar'}: ${error.message}`, 500)

  await sb.rpc('refresh_ranking_view')
  revalidatePath('/rankings')
  return NextResponse.json({ ok: true, id, category, suppressed: !deshacer })
}
