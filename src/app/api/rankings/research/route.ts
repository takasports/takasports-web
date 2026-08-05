// Investigación de un creador para el panel de rankings.
//
// POST /api/rankings/research
//   body: { nombre, instagram?, tiktok?, youtube?, twitter?, twitch? }
//
// Devuelve una ficha completa CON su puntuación calculada. No escribe nada:
// investigar y publicar son dos pasos, y el segundo lo decide una persona.
// El alta se confirma en /api/rankings/create.
//
// Auth: cabecera `x-admin-token` = RANKINGS_ADMIN_TOKEN, igual que /override.

import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { apiError } from '@/lib/api-utils'
import { investigaCreador } from '@/lib/creator-research'

// Wikidata + YouTube + TikTok en cadena: puede pasar de los 10 s por defecto.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req, { headerName: 'x-admin-token', tokenEnv: process.env.RANKINGS_ADMIN_TOKEN }))) {
    return apiError('No autorizado', 401)
  }

  let body: Record<string, string> = {}
  try {
    body = await req.json()
  } catch {
    return apiError('Cuerpo JSON inválido', 400)
  }

  const nombre = String(body.nombre ?? '').trim()
  if (!nombre) return apiError('Falta el nombre', 400)
  // Sin ningún identificador la búsqueda se apoya solo en el nombre, que es
  // justo el caso en el que se cuelan homónimos. Se permite, pero la ficha
  // avisará de por dónde flojea en `fuentes`.

  try {
    const ficha = await investigaCreador(
      {
        nombre,
        instagram: body.instagram,
        tiktok: body.tiktok,
        youtube: body.youtube,
        twitter: body.twitter,
        twitch: body.twitch,
      },
      process.env.YOUTUBE_API_KEY,
    )
    return NextResponse.json({ ok: true, ficha })
  } catch (e) {
    return apiError(`Falló la investigación: ${e instanceof Error ? e.message : String(e)}`, 500)
  }
}
