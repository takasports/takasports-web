// Productor de la "pregunta de actualidad" (Q1) de CrackQuiz — T7·1.
// Lee un artículo reciente de Sanity y genera con Gemini (flash-lite) una MCQ
// de una sola pregunta basada EXCLUSIVAMENTE en el contenido de la noticia.
// Con salvaguardas de calidad: si el modelo no produce una pregunta válida e
// inequívoca, devuelve null (no se publica basura). NO otorga puntos ni toca la
// economía; solo alimenta la tabla crackquiz_featured que el juego ya consume.
//
// Coste ~$0 (familia flash-lite/flash, nivel gratuito). GEMINI_API_KEY en env.

import { sanityClient, articlesQuery, articleDetailQuery } from '@/lib/sanity'

// Cadena de modelos GRATUITOS (nivel free de Google AI Studio), en orden. Cada
// modelo tiene su propio cupo diario en el nivel gratuito, así que si uno da 429
// (cupo agotado) o 404 (retirado) se prueba el siguiente. Solo familia flash /
// flash-lite: nada de "pro".
//
// Por qué: la pregunta dejó de generarse el 24/07/2026 sin una línea en los
// logs. El código no cambió; el cron corre a las 06:00 UTC, justo ANTES de que
// Google reinicie el cupo diario (medianoche del Pacífico = 07:00/08:00 UTC), y
// el pipeline de n8n tira de Gemini free a destajo — si comparten proyecto, a
// esa hora el cupo está agotado. Con un único modelo y `if (!res.ok) return
// null`, cada fallo era un 200 «no_valid_question» mudo.
export const GEMINI_MODELS: string[] = [...new Set([
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
].filter((m): m is string => !!m))]

export interface FeaturedQuestion {
  id: string
  question: string
  options: string[] // exactamente 4
  correctIndex: number // 0..3
  category: string
}

export interface GenResult {
  question: FeaturedQuestion
  source: { slug: string; title: string }
}

interface ListedArticle {
  _id: string
  slug: string
  title: string
  short_summary?: string
  sport?: string
  category?: string
  publishedAt?: string
}

// ── Extracción de texto para el prompt ────────────────────────────────────────

type PTSpan = { _type?: string; text?: string }
type PTBlock = { _type?: string; children?: PTSpan[] }

function portableToText(body: unknown, max = 1400): string {
  if (typeof body === 'string') return body.slice(0, max)
  if (!Array.isArray(body)) return ''
  const out: string[] = []
  for (const block of body as PTBlock[]) {
    if (block?._type === 'block' && Array.isArray(block.children)) {
      const line = block.children
        .filter((c) => c?._type === 'span' && typeof c.text === 'string')
        .map((c) => c.text)
        .join('')
      if (line.trim()) out.push(line.trim())
    }
    if (out.join(' ').length >= max) break
  }
  return out.join('\n').slice(0, max)
}

function tldrToText(tldr: unknown): string {
  if (Array.isArray(tldr)) return tldr.filter((t) => typeof t === 'string').join(' · ')
  if (typeof tldr === 'string') return tldr
  return ''
}

// ── Gemini (REST, sin dependencias nuevas) ────────────────────────────────────

type GeminiOutcome =
  | { ok: true; text: string }
  | { ok: false; status: number; detail: string }

async function callGemini(prompt: string, apiKey: string, model: string): Promise<GeminiOutcome> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  try {
    const res = await fetch(url, {
      method: 'POST',
      // La clave va en cabecera, no en la URL: así no puede acabar en un log.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(18_000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
      }),
    })
    if (!res.ok) {
      let detail = ''
      try {
        const j = (await res.json()) as { error?: { status?: string; message?: string } }
        detail = [j?.error?.status, j?.error?.message].filter(Boolean).join(': ').slice(0, 240)
      } catch { /* cuerpo no JSON */ }
      return { ok: false, status: res.status, detail }
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
    }
    // Los modelos con razonamiento pueden mandar antes una parte `thought`: se
    // une solo el texto de respuesta.
    const parts = json?.candidates?.[0]?.content?.parts ?? []
    const text = parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('')
    return text ? { ok: true, text } : { ok: false, status: 200, detail: 'respuesta vacía' }
  } catch (e) {
    const name = (e as { name?: string })?.name
    return { ok: false, status: 0, detail: name === 'TimeoutError' ? 'timeout 18 s' : (e as Error)?.message ?? 'error de red' }
  }
}

/** ¿El fallo es del modelo (probar otro) o de la clave/petición (no insistir)? */
function fallaDelModelo(status: number): boolean {
  return status === 404 || status === 429 || status === 500 || status === 503 || status === 0
}

function buildPrompt(a: { title: string; sport?: string; summary: string; body: string }): string {
  const ctx = [
    `Título: ${a.title}`,
    a.sport ? `Deporte: ${a.sport}` : '',
    a.summary ? `Resumen: ${a.summary}` : '',
    a.body ? `Contenido:\n${a.body}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return `Eres el editor de un juego de trivia deportiva (Taka Sports). A partir de esta noticia, crea UNA pregunta de opción múltiple de "actualidad" para los lectores.

NOTICIA:
${ctx}

REGLAS ESTRICTAS:
- La pregunta debe basarse EXCLUSIVAMENTE en hechos presentes en la noticia. NO inventes datos ni uses conocimiento externo.
- Debe tener UNA sola respuesta correcta inequívoca según la noticia, y 3 distractores plausibles pero claramente incorrectos.
- Redáctala en español de España, clara y concisa (máximo 140 caracteres).
- Exactamente 4 opciones, cortas (máximo 60 caracteres cada una), distintas entre sí. No uses "Todas las anteriores".
- "category": una sola palabra del tema o deporte (p. ej. "Fútbol", "Tenis", "Fichajes", "Mundial").
- Si la noticia NO permite una pregunta con respuesta inequívoca, responde exactamente {"skip": true}.

Responde SOLO con un JSON válido, sin texto adicional, con esta forma:
{"question": "…", "options": ["…", "…", "…", "…"], "correctIndex": 0, "category": "…"}`
}

// ── Validación (salvaguardas de calidad) ──────────────────────────────────────

function parseAndValidate(raw: string, id: string): FeaturedQuestion | null {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    // A veces el modelo envuelve en ```json … ```
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      obj = JSON.parse(m[0])
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object') return null
  const c = obj as Record<string, unknown>
  if (c.skip === true) return null

  if (typeof c.question !== 'string') return null
  const question = c.question.trim()
  if (question.length < 8 || question.length > 200) return null

  if (!Array.isArray(c.options) || c.options.length !== 4) return null
  const options = c.options.map((o) => (typeof o === 'string' ? o.trim() : ''))
  if (options.some((o) => o.length === 0 || o.length > 90)) return null
  // Sin duplicados (case-insensitive).
  const lower = options.map((o) => o.toLowerCase())
  if (new Set(lower).size !== 4) return null

  if (typeof c.correctIndex !== 'number' || !Number.isInteger(c.correctIndex)) return null
  if (c.correctIndex < 0 || c.correctIndex > 3) return null

  const category =
    typeof c.category === 'string' && c.category.trim().length > 0
      ? c.category.trim().slice(0, 24)
      : 'Actualidad'

  return { id, question, options, correctIndex: c.correctIndex, category }
}

// ── Generador principal ───────────────────────────────────────────────────────

function slugId(day: string, slug: string): string {
  return `feat-${day}-${slug.replace(/[^a-z0-9-]/gi, '').slice(0, 28)}`
}

/**
 * Genera la pregunta de actualidad para `day` (YYYY-MM-DD). Prueba con los
 * artículos más recientes hasta que uno produzca una MCQ válida, y con la
 * cadena de modelos gratuitos si uno falla. Devuelve la pregunta + la fuente,
 * o null si nada sirvió (o falta la API key). `motivos` recoge por qué falló
 * cada intento, para que el cron lo deje en el log y en su respuesta.
 */
export async function generateFeaturedQuestion(day: string, motivos: string[] = []): Promise<GenResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    motivos.push('falta GEMINI_API_KEY')
    return null
  }

  let listed: ListedArticle[] = []
  try {
    listed = (await sanityClient.fetch(articlesQuery)) as ListedArticle[]
  } catch (e) {
    motivos.push(`Sanity: ${(e as Error)?.message ?? 'error'}`)
    return null
  }
  if (!Array.isArray(listed) || listed.length === 0) {
    motivos.push('Sanity no devolvió artículos')
    return null
  }

  // Candidatos: recientes con título y slug; hasta 3 intentos. Tope de tiempo
  // global para caber en maxDuration 60 aunque haya que cambiar de modelo.
  const candidates = listed.filter((a) => a?.slug && a?.title).slice(0, 3)
  const limite = Date.now() + 45_000
  const modelosVivos = [...GEMINI_MODELS]

  for (const cand of candidates) {
    if (Date.now() > limite || modelosVivos.length === 0) break
    // Detalle para enriquecer el contexto (tldr + cuerpo).
    let summary = cand.short_summary ?? ''
    let bodyTxt = ''
    try {
      const detail = (await sanityClient.fetch(articleDetailQuery, { id: cand.slug })) as {
        short_summary?: string
        tldr?: unknown
        bodyPortable?: unknown
        bodyText?: unknown
      } | null
      if (detail) {
        summary = [detail.short_summary || summary, tldrToText(detail.tldr)].filter(Boolean).join(' — ')
        bodyTxt = portableToText(detail.bodyPortable ?? detail.bodyText)
      }
    } catch {
      /* usamos solo title + short_summary */
    }

    const prompt = buildPrompt({ title: cand.title, sport: cand.sport, summary, body: bodyTxt })

    let raw: string | null = null
    while (modelosVivos.length > 0 && Date.now() <= limite) {
      const model = modelosVivos[0]
      const r = await callGemini(prompt, apiKey, model)
      if (r.ok) { raw = r.text; break }
      motivos.push(`${model}: ${r.status || 'red'}${r.detail ? ` ${r.detail}` : ''}`)
      if (!fallaDelModelo(r.status)) {
        // 400/401/403: clave inválida o petición rechazada — otro modelo no lo arregla.
        if (r.status !== 200) return null
        break // respuesta vacía: siguiente artículo, mismo modelo
      }
      modelosVivos.shift() // cupo agotado / retirado: se descarta para el resto
    }
    if (!raw) continue

    const q = parseAndValidate(raw, slugId(day, cand.slug))
    if (q) return { question: q, source: { slug: cand.slug, title: cand.title } }
    motivos.push(`pregunta no válida para «${cand.slug}»`)
  }

  return null
}
