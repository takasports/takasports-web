// ─────────────────────────────────────────────────────────────────
// Avisos de NOTICIAS — orquestación (Sanity + registro + envío por tema).
//
// Lo llama /api/sanity-webhook después de responder (`after`), para cada
// artículo que se crea o se actualiza. El webhook salta muchas veces por
// artículo (creación, y luego cada parche: el título SEO por cron, la foto…),
// así que la idempotencia la pone el registro `avisos_noticias_log`
// (migración 136): un aviso por artículo y tema, y como mucho 2 por tema y día.
//
// `enviar: false` (AVISOS_NOTICIAS_ENABLED apagado) decide igual y devuelve lo
// que haría, sin escribir en la base de datos ni enviar.
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@sanity/client'
import { adminSupabase } from './supabase-admin'
import { audienciaDeTema, sendPushToTopic, type TopicResult } from './push-topic'
import {
  articuloDesdePayload, decidirAvisoNoticia, faltanDatos, plazaLibre, textoAvisoNoticia,
  TOPE_POR_TEMA_DIA, type ArticuloAviso, type DecisionNoticia,
} from './avisos-noticias'

export interface InformeNoticia {
  enviado: boolean
  articulo: string | null
  decision: DecisionNoticia | { ok: false; motivo: 'no_es_articulo' }
  texto?: ReturnType<typeof textoAvisoNoticia>
  audiencia?: { web: number; app: number } | null
  plazasOcupadas?: number[]
  resultado?: { plaza: number | null; motivo?: string; envio?: TopicResult }
}

/** GROQ del artículo con los campos que hacen falta para decidir. */
export const ARTICULO_AVISO_GROQ = `{
  _id, _type,
  "slug": slug.current,
  headline, title, sport, publishedAt, takaScore, type, priority, status,
  metaDescription, short_summary, tldr
}`

// Sin CDN a propósito: justo después de publicar, el CDN de Sanity puede no
// tener aún el artículo. Es UNA lectura por webhook y solo si el payload no
// trae los campos.
function sanityDirecto() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
  if (!projectId || !dataset) return null
  return createClient({ projectId, dataset, apiVersion: '2024-01-01', useCdn: false })
}

async function completarDesdeSanity(a: ArticuloAviso): Promise<ArticuloAviso> {
  const client = sanityDirecto()
  if (!client) return a
  try {
    const doc = await client.fetch<Record<string, unknown> | null>(
      `*[_type == "article" && (_id == $id || slug.current == $slug)][0]${ARTICULO_AVISO_GROQ}`,
      { id: a.id, slug: a.slug ?? '' },
    )
    if (!doc) return a
    // El slug viene ya aplanado; se reempaqueta para el mismo lector.
    return articuloDesdePayload({ ...doc, slug: { current: doc.slug } }) ?? a
  } catch {
    return a
  }
}

/**
 * Antes de gastar una lectura de la API directa de Sanity (cupo pequeño), se
 * mira si con lo que ya trae el payload el artículo queda descartado pase lo
 * que pase: viejo, de madrugada, borrador, previa… Se decide suponiendo lo más
 * favorable para lo que falta.
 */
function merecePreguntar(a: ArticuloAviso, ahora: Date): boolean {
  const optimista: ArticuloAviso = {
    ...a,
    slug: a.slug ?? 'x', titulo: a.titulo ?? 'x', sport: a.sport ?? 'futbol',
    publishedAt: a.publishedAt ?? ahora.toISOString(),
    takaScore: a.takaScore ?? 100,
  }
  return decidirAvisoNoticia(optimista, ahora).ok
}

export async function avisarNoticiaPublicada(
  payload: Record<string, unknown>,
  opts: { enviar: boolean; ahora?: Date },
): Promise<InformeNoticia> {
  const ahora = opts.ahora ?? new Date()
  let art = articuloDesdePayload(payload)
  if (!art) return { enviado: false, articulo: null, decision: { ok: false, motivo: 'no_es_articulo' } }
  if (faltanDatos(art) && merecePreguntar(art, ahora)) art = await completarDesdeSanity(art)

  const decision = decidirAvisoNoticia(art, ahora)
  const informe: InformeNoticia = { enviado: opts.enviar, articulo: art.slug ?? art.id, decision }
  if (!decision.ok) return informe

  informe.texto = textoAvisoNoticia(art)
  informe.audiencia = await audienciaDeTema(decision.tema).catch(() => null)

  const admin = adminSupabase()
  if (!admin) return { ...informe, resultado: { plaza: null, motivo: 'supabase_no_configurado' } }

  // Lo ya avisado hoy en este tema, y si ESTE artículo ya se avisó.
  const { data: delDia, error: logErr } = await admin
    .from('avisos_noticias_log')
    .select('article_id, slot')
    .eq('topic', decision.tema)
    .eq('madrid_day', decision.dia)
  if (logErr) {
    // Sin registro no hay tope ni idempotencia: se informa, nunca se envía.
    return { ...informe, resultado: { plaza: null, motivo: `registro no disponible: ${logErr.message}` } }
  }
  informe.plazasOcupadas = (delDia ?? []).map((r) => Number(r.slot))
  if ((delDia ?? []).some((r) => r.article_id === art.id)) {
    return { ...informe, resultado: { plaza: null, motivo: 'ya_avisado' } }
  }
  const { data: antes } = await admin
    .from('avisos_noticias_log')
    .select('article_id')
    .eq('article_id', art.id)
    .eq('topic', decision.tema)
    .limit(1)
  if (antes && antes.length > 0) return { ...informe, resultado: { plaza: null, motivo: 'ya_avisado' } }

  const libre = plazaLibre(informe.plazasOcupadas)
  if (!opts.enviar) {
    return { ...informe, resultado: { plaza: libre, motivo: libre ? 'simulacion' : 'tope_diario' } }
  }

  // Reclamar plaza: la restricción única (topic, madrid_day, slot) hace que dos
  // webhooks simultáneos no se queden la misma; y la PK (article_id, topic),
  // que el mismo artículo no se avise dos veces.
  let plaza: number | null = null
  for (let slot = libre ?? TOPE_POR_TEMA_DIA + 1; slot <= TOPE_POR_TEMA_DIA; slot++) {
    const { error } = await admin.from('avisos_noticias_log').insert({
      article_id: art.id, topic: decision.tema, madrid_day: decision.dia, slot,
      title: informe.texto.title,
    })
    if (!error) { plaza = slot; break }
    if (error.code !== '23505') {
      return { ...informe, resultado: { plaza: null, motivo: `error_registro: ${error.message}` } }
    }
    // 23505: o esa plaza ya está cogida (probar la siguiente) o el artículo
    // ya está registrado (la siguiente vuelta fallará igual y se acaba).
  }
  if (plaza === null) return { ...informe, resultado: { plaza: null, motivo: 'tope_diario' } }

  const envio = await sendPushToTopic(decision.tema, informe.texto)
  return { ...informe, resultado: { plaza, envio } }
}
