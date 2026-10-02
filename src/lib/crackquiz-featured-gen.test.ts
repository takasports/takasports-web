import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/sanity', () => ({
  articlesQuery: 'LIST',
  articleDetailQuery: 'DETAIL',
  sanityClient: {
    fetch: vi.fn(async (q: string) =>
      q === 'LIST'
        ? [{ _id: '1', slug: 'mbappe-marca', title: 'Mbappé marca dos goles' }]
        : { short_summary: 'Doblete de Mbappé', bodyPortable: [] }),
  },
}))

import { GEMINI_MODELS, generateFeaturedQuestion } from './crackquiz-featured-gen'

const PREGUNTA = JSON.stringify({
  question: '¿Cuántos goles marcó Mbappé?', options: ['Uno', 'Dos', 'Tres', 'Cuatro'], correctIndex: 1, category: 'Fútbol',
})
const okGemini = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: PREGUNTA }] } }] }), { status: 200 })
const errGemini = (status: number, msg: string) =>
  new Response(JSON.stringify({ error: { status: 'X', message: msg } }), { status })

describe('generateFeaturedQuestion', () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = 'k' })
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.GEMINI_API_KEY })

  it('solo modelos gratuitos de la familia flash', () => {
    expect(GEMINI_MODELS.length).toBeGreaterThan(1)
    for (const m of GEMINI_MODELS) expect(m).toMatch(/flash/)
  })

  it('con el cupo agotado en el primer modelo, pasa al siguiente', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(errGemini(429, 'quota'))
      .mockResolvedValueOnce(okGemini())
    vi.stubGlobal('fetch', f)
    const motivos: string[] = []
    const r = await generateFeaturedQuestion('2026-10-02', motivos)
    expect(r?.question.correctIndex).toBe(1)
    expect(motivos[0]).toContain('429')
    expect(String(f.mock.calls[0][0])).toContain(GEMINI_MODELS[0])
    expect(String(f.mock.calls[1][0])).toContain(GEMINI_MODELS[1])
    // La clave nunca viaja en la URL.
    expect(String(f.mock.calls[0][0])).not.toContain('key=')
  })

  it('clave rechazada (403): no insiste con otros modelos y explica por qué', async () => {
    const f = vi.fn().mockResolvedValue(errGemini(403, 'API key not valid'))
    vi.stubGlobal('fetch', f)
    const motivos: string[] = []
    expect(await generateFeaturedQuestion('2026-10-02', motivos)).toBeNull()
    expect(f).toHaveBeenCalledTimes(1)
    expect(motivos.join(' ')).toContain('API key not valid')
  })

  it('sin clave lo dice', async () => {
    delete process.env.GEMINI_API_KEY
    const motivos: string[] = []
    expect(await generateFeaturedQuestion('2026-10-02', motivos)).toBeNull()
    expect(motivos).toEqual(['falta GEMINI_API_KEY'])
  })
})
