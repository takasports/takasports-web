// GET/POST /api/cron/newsletter-semanal
//
// La newsletter de los lunes. APAGADA por defecto: mientras NEWSLETTER_ENABLED
// no valga "true", NO manda nada y devuelve lo que mandaría (asunto, bloques,
// suscriptores) para revisarlo. Ver lib/newsletter/.
//
// Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron) o `x-cron-secret`.
//
// Parámetros:
//   ?format=html  → el correo tal cual (para mirarlo en el navegador)
//   ?format=text  → la versión en texto plano
//   ?format=json  → el contenido elegido, en crudo (para depurar la selección)
//   ?vista=1      → la PRÓXIMA edición (el lunes que viene) en vez de la de esta semana
//   ?dry=1        → aunque esté encendida, no envía (solo informe)
//
// Idempotente por semana: la edición es «semanal-AAAA-SS» y la tabla
// newsletter_ediciones (migración 137) impide repetirla. Por eso el cron puede
// ir lunes y martes: el martes solo completa lo que el lunes no pudo.

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { cargarContenidoSemanal } from '@/lib/newsletter/datos-semanal'
import { renderSemanalHtml, renderSemanalTexto } from '@/lib/newsletter/plantilla-semanal'
import { asuntoSemanal, contenidoSuficiente, preheaderSemanal } from '@/lib/newsletter/semanal'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BAJA_DE_MUESTRA = 'https://www.takasportsmedia.com/newsletter/baja'

function encendida(): boolean {
  const v = (process.env.NEWSLETTER_ENABLED ?? '').trim().toLowerCase()
  return v === 'true' || v === '1'
}

async function suscriptoresActivos(): Promise<number | null> {
  const { adminSupabase } = await import('@/lib/supabase-admin')
  const sb = adminSupabase()
  if (!sb) return null
  const { count, error } = await sb
    .from('newsletter_subscribers')
    .select('id', { count: 'exact', head: true })
    .is('unsubscribed_at', null)
  return error ? null : count ?? 0
}

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const params = new URL(req.url).searchParams
  const formato = params.get('format')
  const modo = params.get('vista') === '1' ? 'vista' : 'envio'
  const { contenido, avisos } = await cargarContenidoSemanal(new Date(), modo)

  if (formato === 'html') {
    return new NextResponse(renderSemanalHtml(contenido, { bajaUrl: BAJA_DE_MUESTRA }), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  if (formato === 'json') {
    return NextResponse.json({ contenido, avisos }, { headers: { 'cache-control': 'no-store' } })
  }
  if (formato === 'text') {
    return new NextResponse(renderSemanalTexto(contenido, { bajaUrl: BAJA_DE_MUESTRA }), {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  const asunto = asuntoSemanal(contenido)
  const suficiente = contenidoSuficiente(contenido)
  const resumen = {
    edicion: contenido.edicion.clave,
    lunes: contenido.edicion.lunes,
    asunto,
    preheader: preheaderSemanal(contenido),
    destacadas: contenido.destacadas.map(n => n.titulo),
    masLeidas: contenido.masLeidas.map(n => n.titulo),
    partidos: contenido.partidos.map(p => `${p.dia} ${p.hora} · ${p.titulo} (${p.comp})`),
    movimientos: contenido.movimientos.map(m => `${m.nombre} +${m.delta}`),
    ligaTaka: {
      jornada: contenido.ligaTaka.jornada.length,
      general: contenido.ligaTaka.general.length,
      abierta: contenido.ligaTaka.abierta?.partidos ?? 0,
    },
    juego: `${contenido.juego.nombre}: ${contenido.juego.titulo}`,
    avisos,
  }

  if (!encendida() || params.get('dry') === '1') {
    return NextResponse.json({
      ok: true,
      enviado: false,
      motivo: encendida() ? 'dry_run' : 'NEWSLETTER_ENABLED apagado: no se envía nada',
      suscriptoresActivos: await suscriptoresActivos(),
      listoParaEnviar: suficiente.ok,
      faltaParaEnviar: suficiente.motivo ?? null,
      ...resumen,
    })
  }

  if (!suficiente.ok) {
    // Mejor no mandar que mandar un correo cojo: el lunes que viene habrá otro.
    return NextResponse.json({ ok: false, enviado: false, motivo: suficiente.motivo, ...resumen })
  }

  const { enviarEdicion } = await import('@/lib/newsletter/envio')
  const max = Number.parseInt(process.env.NEWSLETTER_MAX_POR_EJECUCION ?? '', 10)
  const resultado = await enviarEdicion({
    edicion: contenido.edicion.clave,
    asunto,
    html: renderSemanalHtml(contenido),
    texto: renderSemanalTexto(contenido),
    maxPorEjecucion: Number.isFinite(max) && max > 0 ? max : 90,
  })

  return NextResponse.json({ ...resultado, enviado: resultado.enviados > 0, ...resumen }, {
    status: resultado.ok ? 200 : 500,
  })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
