// Encargo de producción propia (previas, crónicas) para el redactor de taka-system.
//
// El redactor (WF-08) trabaja sobre `route_jobs`, y cada trabajo apunta a un
// `content_item`. Para una nota que no nace de una noticia de RSS, el content_item
// es solo el soporte que WF-08 espera encontrar: nace "aprobado", puntuado y
// avisado, para que ningún otro workflow (enriquecimiento, scoring, avisos,
// limpieza) lo coja como si fuera una noticia. El encargo de verdad va en
// `input_json` del route_job: tipo, partido y dossier de datos verificados.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CandidataPrevia } from '@/lib/previas'

const SITE = 'https://www.takasportsmedia.com'

export type TipoProduccion = 'previa' | 'cronica'

/** matchRef de los encargos de un tipo hechos en los últimos `dias`. */
export async function encargosRecientes(sb: SupabaseClient, kind: TipoProduccion, dias: number) {
  const { data, error } = await sb
    .from('route_jobs')
    .select('input_json, created_at')
    .eq('input_json->>kind', kind)
    .gte('created_at', new Date(Date.now() - dias * 86400_000).toISOString())
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => {
    const ij = r.input_json as { matchRef?: string; datos?: { sport?: string; kickoffIso?: string } } | null
    return { matchRef: ij?.matchRef ?? null, sport: ij?.datos?.sport ?? '', creado: r.created_at as string, kickoff: ij?.datos?.kickoffIso ?? null }
  })
}

/** Día de Madrid de un instante (AAAA-MM-DD): los topes diarios van por él. */
export const diaMadrid = (t: number | string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t))

export async function encargar(
  sb: SupabaseClient,
  kind: TipoProduccion,
  c: CandidataPrevia,
  datos: unknown,
  dossier: string,
): Promise<string | null> {
  const ref = c.ev.matchRef!
  const titulo = `${kind === 'previa' ? 'Previa' : 'Crónica'}: ${c.ev.home} - ${c.ev.away}`
  const resumen = kind === 'previa'
    ? `${c.ev.comp}. ${c.ev.home} recibe a ${c.ev.away}.`
    : `${c.ev.comp}. ${c.ev.home} ${c.ev.homeScore ?? '?'} - ${c.ev.awayScore ?? '?'} ${c.ev.away}.`
  const ahora = new Date().toISOString()
  const { data: ci, error: errCi } = await sb.from('content_items').insert({
    canonical_title: titulo,
    original_title: titulo,
    summary: resumen,
    original_url: `${SITE}/partido/${ref}#${kind}`,
    sport: c.sport,
    language: 'es',
    status: 'approved',
    priority: 'high',
    confidence_level: 'high',
    source_count: 1,
    source_list_json: [],
    enriched_at: ahora,
    score: Math.min(100, Math.round(c.puntuacion * 5)),
    alert_type: kind,
    notified_at: ahora,
    entities_json: {
      teams: [c.ev.home, c.ev.away],
      players: [],
      competition: c.ev.comp,
      event_type: kind,
      title_es: titulo,
      summary_es: resumen,
      sport_relevance: 10,
    },
  }).select('id').single()
  if (errCi || !ci) return 'content_item: ' + (errCi?.message ?? '?')

  const { error: errJob } = await sb.from('route_jobs').insert({
    content_item_id: ci.id,
    route: 'web',
    step: 'article',
    step_status: 'pending',
    status: 'pending',
    input_json: { kind, matchRef: ref, puntuacion: c.puntuacion, datos, dossier, origen: `cron-${kind}s` },
  })
  if (errJob) return 'route_job: ' + errJob.message

  await sb.from('decision_log').insert({
    content_item_id: ci.id,
    action: `${kind}_encargada`,
    actor: `system:cron-${kind}s`,
    routes_selected: ['web'],
    metadata_json: { matchRef: ref, puntuacion: c.puntuacion },
  })
  return null
}
