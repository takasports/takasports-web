// ─────────────────────────────────────────────────────────────────
// Avisos de NOTICIAS — lógica pura (sin red ni base de datos).
//
// `ArticlePushCta`, al final de cada artículo, suscribe el navegador a
// `noticias` y `noticias:<deporte>`. Nadie emitía esos temas: quien pulsaba
// «avísame» no recibía nada nunca. Esto decide, para cada artículo que llega
// por el webhook de Sanity, si merece aviso y con qué texto.
//
// ── Qué es «importante» (criterio conservador, 03/10/2026) ──────────────
// El campo editorial `priority` existe en el schema pero el pipeline NO lo
// rellena: 0 de 226 artículos de septiembre lo tienen, y `status` vale
// 'normal' en todos. Lo que sí trae cada artículo es `takaScore`, la nota que
// pone el pipeline al elegir el tema (46-100; mediana 72, p75 84, p90 93 en el
// último mes). Se avisa si:
//   · alguien lo marca a mano como `priority` hero/destacado o es `breaking`, o
//   · `takaScore` ≥ 85 (aprox. el cuarto superior),
// y NUNCA si es una previa automática, una columna de opinión o una galería.
// Encima, el tope: 2 avisos por tema y día (los primeros que lleguen) y nada
// de más de 3 h. Con los datos de septiembre, ≥85 da avisos casi todos los
// días en fútbol y alguno suelto en el resto: el tope hace el resto.
//
// ── Horario ─────────────────────────────────────────────────────────────
// Solo de 9:00 a 23:00 en Madrid. Las suscripciones del navegador no guardan
// zona horaria, así que no se puede afinar por persona. Para Latam, las 9:00
// de Madrid son las 1-4 de la madrugada: si el público de los avisos resulta
// ser latino, hay que guardar la zona al suscribirse y filtrar aquí.
// ─────────────────────────────────────────────────────────────────

import { getSportLabel } from './sports'
import { madridDayISO, madridParts } from './taka-time'

export const TOPE_POR_TEMA_DIA = 2
export const MAX_ANTIGUEDAD_MIN = 180
export const UMBRAL_TAKA_SCORE = 85
// La crónica tiene su propio aviso, «Pitido final» (/api/cron/push-cronicas, 05/10/2026):
// fuera de aquí para que el mismo partido no avise dos veces.
export const TIPOS_EXCLUIDOS: ReadonlySet<string> = new Set(['previa', 'cronica', 'columna', 'galeria'])
export const FRANJA_MADRID = { desde: 9, hasta: 23 } as const
const PRIORIDADES_FUERTES = new Set(['hero', 'destacado'])
const ESTADOS_NO_PUBLICADOS = new Set(['borrador', 'draft', 'pendiente_aprobacion', 'archivado'])

export interface ArticuloAviso {
  id: string
  slug: string | null
  titulo: string | null
  sport: string | null
  publishedAt: string | null
  takaScore?: number | null
  type?: string | null
  priority?: string | null
  status?: string | null
  resumen?: string | null
}

/** Payload del webhook (documento entero si el webhook no tiene proyección). */
export function articuloDesdePayload(p: Record<string, unknown>): ArticuloAviso | null {
  if (!p || p._type !== 'article') return null
  const slugRaw = p.slug as { current?: string } | string | undefined
  const slug = typeof slugRaw === 'string' ? slugRaw : slugRaw?.current ?? null
  const id = typeof p._id === 'string' ? p._id : (slug ?? '')
  if (!id) return null
  const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const tldr = Array.isArray(p.tldr) ? str(p.tldr[0]) : null
  return {
    id,
    slug,
    titulo: str(p.headline) ?? str(p.title),
    sport: str(p.sport),
    publishedAt: str(p.publishedAt),
    takaScore: num(p.takaScore),
    type: str(p.type),
    priority: str(p.priority),
    status: str(p.status),
    resumen: str(p.metaDescription) ?? str(p.short_summary) ?? tldr,
  }
}

/** ¿Faltan datos para decidir? Entonces hay que leer el artículo de Sanity. */
export function faltanDatos(a: ArticuloAviso): boolean {
  return !a.slug || !a.titulo || !a.sport || !a.publishedAt || a.takaScore === undefined
}

export function temaDeArticulo(a: Pick<ArticuloAviso, 'sport'>): string | null {
  const s = (a.sport ?? '').trim().toLowerCase()
  return /^[a-z0-9-]{2,30}$/.test(s) ? `noticias:${s}` : null
}

export function esImportante(a: ArticuloAviso): { ok: boolean; por: string } {
  const tipo = (a.type ?? '').toLowerCase()
  if (TIPOS_EXCLUIDOS.has(tipo)) return { ok: false, por: `tipo_${tipo}` }
  if (PRIORIDADES_FUERTES.has((a.priority ?? '').toLowerCase())) return { ok: true, por: `priority_${a.priority}` }
  if (tipo === 'breaking' || (a.status ?? '').toLowerCase() === 'breaking') return { ok: true, por: 'breaking' }
  if (a.takaScore != null && a.takaScore >= UMBRAL_TAKA_SCORE) return { ok: true, por: `takaScore_${a.takaScore}` }
  return { ok: false, por: a.takaScore == null ? 'sin_takaScore' : `takaScore_${a.takaScore}` }
}

export type DecisionNoticia =
  | { ok: true; tema: string; dia: string; por: string }
  | { ok: false; motivo: string }

export function decidirAvisoNoticia(a: ArticuloAviso, ahora: Date): DecisionNoticia {
  if (a.id.startsWith('drafts.')) return { ok: false, motivo: 'borrador' }
  if (ESTADOS_NO_PUBLICADOS.has((a.status ?? '').toLowerCase())) return { ok: false, motivo: `estado_${a.status}` }
  if (!a.slug || !a.titulo) return { ok: false, motivo: 'incompleto' }
  const tema = temaDeArticulo(a)
  if (!tema) return { ok: false, motivo: 'sin_deporte' }
  if (!a.publishedAt) return { ok: false, motivo: 'sin_fecha' }
  const pub = new Date(a.publishedAt).getTime()
  if (!Number.isFinite(pub)) return { ok: false, motivo: 'sin_fecha' }
  const edadMin = (ahora.getTime() - pub) / 60_000
  if (edadMin > MAX_ANTIGUEDAD_MIN) return { ok: false, motivo: 'antigua' }
  if (edadMin < -10) return { ok: false, motivo: 'programada' }
  const { hour: hora } = madridParts(ahora)
  if (hora < FRANJA_MADRID.desde || hora >= FRANJA_MADRID.hasta) return { ok: false, motivo: 'madrugada' }
  const imp = esImportante(a)
  if (!imp.ok) return { ok: false, motivo: `no_importante:${imp.por}` }
  return { ok: true, tema, dia: madridDayISO(ahora), por: imp.por }
}

/** Corta en palabra entera y añade «…». */
export function recortar(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const corte = t.slice(0, max - 1)
  const espacio = corte.lastIndexOf(' ')
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s,;:.·-]+$/, '')}…`
}

export function textoAvisoNoticia(a: ArticuloAviso): { title: string; body: string; url: string; tag: string } {
  const deporte = getSportLabel(a.sport ?? undefined)
  const titulo = recortar(a.titulo ?? '', 90)
  const body = a.resumen ? recortar(a.resumen, 140) : `Última hora de ${deporte} en TakaSports.`
  return {
    title: titulo,
    body,
    url: `/noticias/${a.slug}`,
    tag: `noticia-${a.slug}`,
  }
}

/** Primera plaza libre del día para un tema (1..TOPE), o null si está lleno. */
export function plazaLibre(ocupadas: readonly number[]): number | null {
  for (let s = 1; s <= TOPE_POR_TEMA_DIA; s++) if (!ocupadas.includes(s)) return s
  return null
}
