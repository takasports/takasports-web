import { describe, expect, it } from 'vitest'
import {
  articuloDesdePayload, decidirAvisoNoticia, esImportante, faltanDatos, plazaLibre, recortar,
  temaDeArticulo, textoAvisoNoticia, type ArticuloAviso,
} from './avisos-noticias'

// 03/10/2026 18:00 en Madrid (UTC+2).
const AHORA = new Date('2026-10-03T16:00:00Z')

const base: ArticuloAviso = {
  id: 'taka-job-1', slug: 'mbappe-lesion', titulo: 'Mbappé, baja tres semanas', sport: 'futbol',
  publishedAt: '2026-10-03T15:30:00Z', takaScore: 92, type: null, priority: null, status: 'normal',
  resumen: 'El Real Madrid confirma la lesión.',
}

describe('articuloDesdePayload', () => {
  it('lee el documento entero del webhook (headline antes que title)', () => {
    const a = articuloDesdePayload({
      _type: 'article', _id: 'taka-job-1', slug: { current: 'mbappe-lesion' },
      headline: 'Titular Taka', title: 'Viejo', sport: 'futbol', publishedAt: '2026-10-03T15:30:00Z',
      takaScore: '92', status: 'normal', metaDescription: 'Meta',
    })
    expect(a).toMatchObject({ id: 'taka-job-1', slug: 'mbappe-lesion', titulo: 'Titular Taka', takaScore: 92, resumen: 'Meta' })
    expect(a && faltanDatos(a)).toBe(false)
  })
  it('con proyección mínima (_type, slug, status) faltan datos', () => {
    const a = articuloDesdePayload({ _type: 'article', slug: { current: 'x' }, status: 'normal' })
    expect(a && faltanDatos(a)).toBe(true)
  })
  it('ignora lo que no es artículo', () => {
    expect(articuloDesdePayload({ _type: 'reel', _id: 'r1' })).toBeNull()
  })
})

describe('esImportante (criterio conservador)', () => {
  it('takaScore ≥ 85', () => {
    expect(esImportante({ ...base, takaScore: 85 }).ok).toBe(true)
    expect(esImportante({ ...base, takaScore: 84 }).ok).toBe(false)
    expect(esImportante({ ...base, takaScore: null }).ok).toBe(false)
  })
  it('la prioridad editorial manda aunque la nota sea baja', () => {
    expect(esImportante({ ...base, takaScore: 50, priority: 'hero' }).ok).toBe(true)
    expect(esImportante({ ...base, takaScore: 50, type: 'breaking' }).ok).toBe(true)
  })
  it('previas, columnas y galerías nunca', () => {
    expect(esImportante({ ...base, takaScore: 100, type: 'previa' }).ok).toBe(false)
    expect(esImportante({ ...base, takaScore: 100, type: 'columna', priority: 'hero' }).ok).toBe(false)
  })
})

describe('decidirAvisoNoticia', () => {
  it('importante, reciente y a buena hora → tema del deporte y día de Madrid', () => {
    expect(decidirAvisoNoticia(base, AHORA)).toEqual({ ok: true, tema: 'noticias:futbol', dia: '2026-10-03', por: 'takaScore_92' })
  })
  it('más de 3 h → no', () => {
    expect(decidirAvisoNoticia({ ...base, publishedAt: '2026-10-03T12:59:00Z' }, AHORA)).toEqual({ ok: false, motivo: 'antigua' })
    expect(decidirAvisoNoticia({ ...base, publishedAt: '2026-10-03T13:01:00Z' }, AHORA).ok).toBe(true)
  })
  it('de madrugada en Madrid → no', () => {
    const tres = new Date('2026-10-03T01:00:00Z') // 03:00 Madrid
    expect(decidirAvisoNoticia({ ...base, publishedAt: '2026-10-03T00:50:00Z' }, tres)).toEqual({ ok: false, motivo: 'madrugada' })
    const once = new Date('2026-10-03T21:00:00Z') // 23:00 Madrid
    expect(decidirAvisoNoticia({ ...base, publishedAt: '2026-10-03T20:50:00Z' }, once)).toEqual({ ok: false, motivo: 'madrugada' })
  })
  it('borradores, archivados y sin deporte → no', () => {
    expect(decidirAvisoNoticia({ ...base, id: 'drafts.taka-job-1' }, AHORA)).toEqual({ ok: false, motivo: 'borrador' })
    expect(decidirAvisoNoticia({ ...base, status: 'archivado' }, AHORA).ok).toBe(false)
    expect(decidirAvisoNoticia({ ...base, sport: null }, AHORA)).toEqual({ ok: false, motivo: 'sin_deporte' })
  })
  it('poco importante → no, con el motivo', () => {
    expect(decidirAvisoNoticia({ ...base, takaScore: 70 }, AHORA)).toEqual({ ok: false, motivo: 'no_importante:takaScore_70' })
  })
})

describe('tema y texto', () => {
  it('el tema es el mismo que suscribe ArticlePushCta', () => {
    expect(temaDeArticulo({ sport: 'formula1' })).toBe('noticias:formula1')
    expect(temaDeArticulo({ sport: 'Fútbol!' })).toBeNull()
  })
  it('título = titular, cuerpo = entradilla, lleva a la noticia', () => {
    expect(textoAvisoNoticia(base)).toEqual({
      title: 'Mbappé, baja tres semanas',
      body: 'El Real Madrid confirma la lesión.',
      url: '/noticias/mbappe-lesion',
      tag: 'noticia-mbappe-lesion',
    })
    expect(textoAvisoNoticia({ ...base, resumen: null }).body).toBe('Última hora de Fútbol en TakaSports.')
  })
  it('recortar corta en palabra y pone «…»', () => {
    const r = recortar('uno dos tres cuatro cinco seis siete', 20)
    expect(r.length).toBeLessThanOrEqual(20)
    expect(r).toBe('uno dos tres cuatro…')
    expect(recortar('corto', 20)).toBe('corto')
  })
})

describe('plazaLibre (tope 2 por tema y día)', () => {
  it('da la primera libre y null si está lleno', () => {
    expect(plazaLibre([])).toBe(1)
    expect(plazaLibre([1])).toBe(2)
    expect(plazaLibre([2])).toBe(1)
    expect(plazaLibre([1, 2])).toBeNull()
  })
})
