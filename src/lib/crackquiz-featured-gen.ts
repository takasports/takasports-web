// Productor de la "pregunta de actualidad" (Q1) de CrackQuiz — T7·1.
// Lee un artículo reciente de Sanity y genera con Gemini (flash-lite) una MCQ
// de una sola pregunta basada EXCLUSIVAMENTE en el contenido de la noticia.
// Con salvaguardas de calidad: si el modelo no produce una pregunta válida e
// inequívoca, devuelve null (no se publica basura). NO otorga puntos ni toca la
// economía; solo alimenta la tabla crackquiz_featured que el juego ya consume.
//
// Coste ~$0 (gemini flash-lite, nivel gratuito). GEMINI_API_KEY en env.

import { sanityClient, articlesQuery, articleDetailQuery } from '@/lib/sanity'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'

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

async function callGemini(prompt: string, apiKey: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 18_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
      }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
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
 * artículos más recientes hasta que uno produzca una MCQ válida. Devuelve la
 * pregunta + la fuente, o null si nada sirvió (o falta la API key).
 */
export async function generateFeaturedQuestion(day: string): Promise<GenResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  let listed: ListedArticle[] = []
  try {
    listed = (await sanityClient.fetch(articlesQuery)) as ListedArticle[]
  } catch {
    return null
  }
  if (!Array.isArray(listed) || listed.length === 0) return null

  // Candidatos: recientes con título y slug; hasta 3 intentos (cabe en maxDuration 60).
  const candidates = listed.filter((a) => a?.slug && a?.title).slice(0, 3)

  for (const cand of candidates) {
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
    const raw = await callGemini(prompt, apiKey)
    if (!raw) continue

    const q = parseAndValidate(raw, slugId(day, cand.slug))
    if (q) return { question: q, source: { slug: cand.slug, title: cand.title } }
  }

  return null
}
