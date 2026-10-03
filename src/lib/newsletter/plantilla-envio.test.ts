import { describe, it, expect } from 'vitest'
import { BAJA_MARCADOR, esc, renderSemanalHtml, renderSemanalTexto } from './plantilla-semanal'
import { claveIdempotencia, construirMensajes, pendientes, trocear, urlsBaja } from './envio'
import { edicionSemanal, type ContenidoSemanal } from './semanal'

function contenido(): ContenidoSemanal {
  const n = (titulo: string, deporte: string, imagen: string | null = null) => ({
    titulo, resumen: 'Resumen <b>con</b> "comillas"', deporte, competicion: 'LaLiga',
    url: 'https://www.takasportsmedia.com/noticias/x?utm_source=newsletter&utm_medium=email', imagen,
  })
  return {
    edicion: edicionSemanal(new Date('2026-10-05T07:30:00Z')),
    generadoEn: '2026-10-05T07:30:00Z',
    destacadas: [n('Apertura <script>', 'futbol', 'https://img.example/a.jpg'), n('Dos', 'formula1'), n('Tres', 'ufc')],
    masLeidas: [n('Leída 1', 'futbol')],
    masLeidasVentana: 'del 26 sep al 2 oct',
    partidos: [{ dia: 'Lun 5', hora: '20:45', comp: 'Nations', sport: 'Fútbol', titulo: 'Francia – Bélgica', motivo: 'Selección', canal: 'DAZN', url: 'https://x/p' }],
    movimientos: [{ nombre: 'Kylian Mbappé', detalle: 'Hat-trick', bandera: '🇫🇷', score: 91.2, delta: 2.4, url: 'https://x/r' }],
    ligaTaka: {
      jornada: [], jornadaParticipantes: 0, jornadaUrl: 'https://x/pred',
      general: [{ userId: 'u', nombre: 'Gabriel', puntos: 50, puesto: 1 }], generalUrl: 'https://x/liga',
      abierta: { partidos: 9, estrella: 'Francia – Bélgica', url: 'https://x/pred' },
    },
    juego: { id: 'sopacracks', nombre: 'Sopa de Cracks', titulo: 'Leyendas de LaLiga', descripcion: 'Diez cracks.', url: 'https://x/sopa' },
  }
}

describe('renderSemanalHtml', () => {
  const html = renderSemanalHtml(contenido())

  it('escapa todo lo que viene de fuera', () => {
    expect(html).not.toContain('<script>')
    expect(html).toContain('Apertura &lt;script&gt;')
    expect(html).toContain('&quot;comillas&quot;')
    expect(esc(`a&b<"'>`)).toBe('a&amp;b&lt;&quot;&#39;&gt;')
  })

  it('es un correo de tablas a 600 px con fondo de marca y preheader', () => {
    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('width="600"')
    expect(html).toContain('bgcolor="#09090F"')
    expect(html).toContain('<meta name="color-scheme" content="dark">')
    expect(html).toContain('display:none;max-height:0')
  })

  it('lleva el marcador de baja para sustituirlo por destinatario', () => {
    expect(html).toContain(BAJA_MARCADOR)
    expect(renderSemanalHtml(contenido(), { bajaUrl: 'https://b/x' })).not.toContain(BAJA_MARCADOR)
  })

  it('pinta los bloques con datos y omite los vacíos', () => {
    expect(html).toContain('Los partidos de la semana')
    expect(html).toContain('Quién sube')
    expect(html).toContain('La Jornada nueva ya está abierta')
    expect(html).toContain('Jugar ahora')
    expect(html).not.toContain('Jornada de la semana pasada')
    const sinPartidos = renderSemanalHtml({ ...contenido(), partidos: [] })
    expect(sinPartidos).not.toContain('Los partidos de la semana')
  })

  it('las URLs con & quedan escapadas en los atributos', () => {
    expect(html).toContain('utm_source=newsletter&amp;utm_medium=email')
  })

  it('la imagen de apertura lleva texto alternativo', () => {
    expect(html).toMatch(/<img src="https:\/\/img\.example\/a\.jpg"[^>]*alt="Apertura &lt;script&gt;"/)
  })
})

describe('renderSemanalTexto', () => {
  it('tiene todos los enlaces y la baja', () => {
    const t = renderSemanalTexto(contenido(), { bajaUrl: 'https://b/x' })
    expect(t).toContain('TAKA SEMANAL · Nº 41')
    expect(t).toContain('https://x/p')
    expect(t).toContain('Darte de baja: https://b/x')
    expect(t).not.toMatch(/<(table|td|a |p |span)/)
  })
})

describe('envío', () => {
  it('trocear en lotes de 100', () => {
    const xs = Array.from({ length: 250 }, (_, i) => i)
    expect(trocear(xs, 100).map(l => l.length)).toEqual([100, 100, 50])
    expect(trocear([], 100)).toEqual([])
  })

  it('la clave de idempotencia no depende del orden y cambia con la edición', () => {
    expect(claveIdempotencia('semanal-2026-41', ['b', 'a'])).toBe(claveIdempotencia('semanal-2026-41', ['a', 'b']))
    expect(claveIdempotencia('semanal-2026-41', ['a'])).not.toBe(claveIdempotencia('semanal-2026-42', ['a']))
    expect(claveIdempotencia('semanal-2026-41', ['a']).length).toBeLessThan(256)
  })

  it('pendientes quita a quien ya la recibió y los correos repetidos', () => {
    const r = pendientes([
      { id: '1', email: 'a@x.com' }, { id: '2', email: 'b@x.com' }, { id: '3', email: 'A@x.com ' },
    ], new Set(['2']))
    expect(r.map(s => s.id)).toEqual(['1'])
  })

  it('cada mensaje lleva SU baja en el cuerpo y en List-Unsubscribe (un clic)', () => {
    const html = renderSemanalHtml(contenido())
    const texto = renderSemanalTexto(contenido())
    const m = construirMensajes(
      [{ id: '1', email: 'a@x.com' }, { id: '2', email: 'b@x.com' }],
      { asunto: 'A', html, texto },
      email => `tok-${email}`,
    )
    expect(m).toHaveLength(2)
    expect(m[0].to).toEqual(['a@x.com'])
    expect(m[0].html).toContain(urlsBaja('tok-a@x.com').visible)
    expect(m[0].html).not.toContain(BAJA_MARCADOR)
    expect(m[1].text).toContain(urlsBaja('tok-b@x.com').visible)
    expect(m[0].headers['List-Unsubscribe']).toBe(`<${urlsBaja('tok-a@x.com').unClic}>`)
    expect(m[0].headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('la baja visible va a la página con confirmación y la de un clic al endpoint', () => {
    const u = urlsBaja('ab.cd')
    expect(u.visible).toBe('https://www.takasportsmedia.com/newsletter/baja?token=ab.cd')
    expect(u.unClic).toBe('https://www.takasportsmedia.com/api/newsletter/unsubscribe?token=ab.cd')
  })

  it('sin secreto de baja no se construye ningún mensaje', () => {
    expect(() => construirMensajes([{ id: '1', email: 'a@x.com' }], { asunto: 'A', html: '', texto: '' }, () => null))
      .toThrow('sin_secreto_de_baja')
  })
})
