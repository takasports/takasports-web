// ─────────────────────────────────────────────────────────────────────────────
// Envío de la newsletter semanal por Resend, por lotes e idempotente.
//
// Tres cerrojos contra el doble envío, de fuera a dentro:
//   1. `newsletter_ediciones` (migración 137): si la edición consta como
//      «enviada», no se hace nada. La clave es la semana ("semanal-2026-41"),
//      así que un reintento del cron el martes sigue siendo la MISMA edición.
//   2. `newsletter_entregas`: una fila por (edición, suscriptor). Solo se manda
//      a quien no la tiene — si el envío se corta a medias, el siguiente
//      intento sigue donde lo dejó en vez de repetir a los primeros.
//   3. `Idempotency-Key` de Resend por lote (edición + destinatarios): si la
//      respuesta se pierde y se reintenta el mismo lote en 24 h, Resend no lo
//      vuelve a mandar.
//
// Límites de Resend que se respetan: 100 correos por llamada a /emails/batch y
// ~2 llamadas/s (pausa entre lotes y reintento con Retry-After ante un 429).
// El plan gratuito permite 100 correos AL DÍA: `NEWSLETTER_MAX_POR_EJECUCION`
// (90 por defecto) deja margen para los transaccionales (insignias). Si hay más
// suscriptores que eso, la edición queda «parcial» y la siguiente ejecución de
// la MISMA semana (el cron va lunes y martes) sigue con los pendientes.
//
// Sin la migración 137 aplicada NO se envía (no habría forma de garantizar que
// no se repite), y sin NEWSLETTER_UNSUB_SECRET tampoco (un correo masivo sin
// baja funcional incumple la LSSI y las reglas de Gmail/Yahoo).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto'
import { BAJA_MARCADOR } from './plantilla-semanal'

export const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch'
export const LOTE_MAX = 100
const PAUSA_ENTRE_LOTES_MS = 600
const DEFAULT_FROM = 'TakaSports <noreply@takasportsmedia.com>'
const SITE = 'https://www.takasportsmedia.com'

export interface Suscriptor {
  id: string
  email: string
}

export function trocear<T>(xs: readonly T[], n: number): T[][] {
  if (n <= 0) throw new Error('tamaño de lote inválido')
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

/** Clave estable para el lote: misma edición + mismos destinatarios = misma clave. */
export function claveIdempotencia(edicion: string, ids: readonly string[]): string {
  const h = createHash('sha256').update([...ids].sort().join(',')).digest('hex').slice(0, 24)
  return `${edicion}/${h}`
}

/** Quién falta por recibir la edición. */
export function pendientes(subs: readonly Suscriptor[], entregados: ReadonlySet<string>): Suscriptor[] {
  const vistos = new Set<string>()
  return subs.filter(s => {
    const email = s.email.trim().toLowerCase()
    if (entregados.has(s.id) || vistos.has(email)) return false
    vistos.add(email)
    return true
  })
}

/** URLs de baja de un destinatario a partir de su token firmado. */
export function urlsBaja(token: string): { visible: string; unClic: string } {
  const t = encodeURIComponent(token)
  return {
    // La del cuerpo lleva a una página con botón de confirmar: los escáneres de
    // correo siguen todos los enlaces con GET y daban de baja a gente sin clic.
    visible: `${SITE}/newsletter/baja?token=${t}`,
    // La de la cabecera List-Unsubscribe (RFC 8058): el cliente de correo hace
    // un POST con «List-Unsubscribe=One-Click» y el endpoint lee el token de la
    // query. Es lo que pide Gmail a los remitentes masivos.
    unClic: `${SITE}/api/newsletter/unsubscribe?token=${t}`,
  }
}

export interface MensajeResend {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

/**
 * Un mensaje por destinatario con SU enlace de baja. `firmar` devuelve null si
 * no hay secreto: entonces se lanza, porque no se manda nada sin baja.
 */
export function construirMensajes(
  subs: readonly Suscriptor[],
  plantilla: { asunto: string; html: string; texto: string },
  firmar: (email: string) => string | null,
  from = DEFAULT_FROM,
): MensajeResend[] {
  return subs.map(s => {
    const token = firmar(s.email)
    if (!token) throw new Error('sin_secreto_de_baja')
    const baja = urlsBaja(token)
    return {
      from,
      to: [s.email],
      subject: plantilla.asunto,
      html: plantilla.html.split(BAJA_MARCADOR).join(baja.visible),
      text: plantilla.texto.split(BAJA_MARCADOR).join(baja.visible),
      headers: {
        'List-Unsubscribe': `<${baja.unClic}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }
  })
}

// ── E/S ──────────────────────────────────────────────────────────────────────

export interface ResultadoEnvio {
  ok: boolean
  edicion: string
  estado: 'enviada' | 'parcial' | 'ya_enviada' | 'sin_suscriptores' | 'error'
  enviados: number
  pendientes: number
  errores: string[]
}

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))

async function mandarLote(mensajes: MensajeResend[], clave: string, apiKey: string): Promise<{ ids: string[] } | { error: string }> {
  for (let intento = 0; intento < 3; intento++) {
    let res: Response
    try {
      res = await fetch(RESEND_BATCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': clave,
        },
        body: JSON.stringify(mensajes),
      })
    } catch {
      await esperar(1000 * (intento + 1))
      continue
    }
    if (res.status === 429) {
      const tras = Number(res.headers.get('retry-after')) || 1
      await esperar(Math.min(tras, 10) * 1000)
      continue
    }
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '')
      return { error: `resend_${res.status}:${cuerpo.slice(0, 200)}` }
    }
    const json = await res.json().catch(() => ({})) as { data?: Array<{ id?: string }> }
    return { ids: (json.data ?? []).map(d => d.id ?? '') }
  }
  return { error: 'resend_reintentos_agotados' }
}

/** ¿Falta la tabla? (PostgREST: PGRST205; Postgres: 42P01). */
function faltaTabla(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' || /does not exist|could not find the table/i.test(err.message ?? '')
}

export async function enviarEdicion(args: {
  edicion: string
  asunto: string
  html: string
  texto: string
  maxPorEjecucion: number
}): Promise<ResultadoEnvio> {
  const base = { edicion: args.edicion, enviados: 0, pendientes: 0, errores: [] as string[] }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ...base, ok: false, estado: 'error', errores: ['falta_RESEND_API_KEY'] }

  const { signUnsubscribeToken } = await import('@/lib/newsletter-token')
  if (!signUnsubscribeToken('prueba@takasportsmedia.com')) {
    return { ...base, ok: false, estado: 'error', errores: ['falta_NEWSLETTER_UNSUB_SECRET'] }
  }

  const { adminSupabase } = await import('@/lib/supabase-admin')
  const sb = adminSupabase()
  if (!sb) return { ...base, ok: false, estado: 'error', errores: ['supabase_no_configurado'] }

  // 1) ¿Ya salió esta edición?
  const { data: ed, error: edErr } = await sb
    .from('newsletter_ediciones')
    .select('estado')
    .eq('edicion', args.edicion)
    .maybeSingle()
  if (faltaTabla(edErr)) return { ...base, ok: false, estado: 'error', errores: ['falta_migracion_137'] }
  if (edErr) return { ...base, ok: false, estado: 'error', errores: [`ediciones:${edErr.message}`] }
  if (ed?.estado === 'enviada') return { ...base, ok: true, estado: 'ya_enviada' }

  if (!ed) {
    const { error } = await sb.from('newsletter_ediciones').insert({ edicion: args.edicion, asunto: args.asunto })
    // 23505 = otra ejecución la creó a la vez; seguimos, las entregas deciden.
    if (error && error.code !== '23505') return { ...base, ok: false, estado: 'error', errores: [`crear_edicion:${error.message}`] }
  }

  // 2) Suscriptores activos menos los que ya la tienen.
  const [{ data: subs, error: sErr }, { data: hechas, error: hErr }] = await Promise.all([
    sb.from('newsletter_subscribers').select('id,email').is('unsubscribed_at', null).order('created_at', { ascending: true }).range(0, 9999),
    sb.from('newsletter_entregas').select('subscriber_id').eq('edicion', args.edicion).range(0, 9999),
  ])
  if (sErr || hErr) return { ...base, ok: false, estado: 'error', errores: [`leer:${(sErr ?? hErr)?.message}`] }
  const faltan = pendientes((subs ?? []) as Suscriptor[], new Set((hechas ?? []).map(h => h.subscriber_id as string)))
  if ((subs ?? []).length === 0) return { ...base, ok: true, estado: 'sin_suscriptores' }

  const tanda = faltan.slice(0, Math.max(0, args.maxPorEjecucion))
  const errores: string[] = []
  let enviados = 0

  const lotes = trocear(tanda, LOTE_MAX)
  for (let i = 0; i < lotes.length; i++) {
    const lote = lotes[i]
    const mensajes = construirMensajes(lote, args, signUnsubscribeToken, process.env.EMAIL_FROM || undefined)
    const r = await mandarLote(mensajes, claveIdempotencia(args.edicion, lote.map(s => s.id)), apiKey)
    if ('error' in r) { errores.push(r.error); break }
    const filas = lote.map((s, j) => ({ edicion: args.edicion, subscriber_id: s.id, resend_id: r.ids[j] || null }))
    const { error } = await sb.from('newsletter_entregas').upsert(filas, { onConflict: 'edicion,subscriber_id', ignoreDuplicates: true })
    if (error) errores.push(`registrar_entregas:${error.message}`)
    enviados += lote.length
    if (i < lotes.length - 1) await esperar(PAUSA_ENTRE_LOTES_MS)
  }

  const quedan = faltan.length - enviados
  const estado: ResultadoEnvio['estado'] = errores.length && enviados === 0 ? 'error' : quedan > 0 ? 'parcial' : 'enviada'
  await sb.from('newsletter_ediciones').update({
    estado: estado === 'enviada' ? 'enviada' : estado === 'error' ? 'fallida' : 'enviando',
    destinatarios: (subs ?? []).length,
    enviados: (hechas ?? []).length + enviados,
    ultimo_error: errores[0] ?? null,
    terminada_at: estado === 'enviada' ? new Date().toISOString() : null,
  }).eq('edicion', args.edicion)

  return { ok: errores.length === 0, edicion: args.edicion, estado, enviados, pendientes: quedan, errores }
}
