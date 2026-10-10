import { describe, expect, it } from 'vitest'
import fixture from './tenis.fixture.json'
import { apellido } from './seo-partido'
import { construirDossierTenis, esPartidoImportante, marcador, partidosDesdeEvento, refTenis, torneoEs, type PartidoTenis } from './tenis'

// Fixture real de ESPN (10/10/2026): cuadro masculino del Masters de Shanghái y los dos
// cuadros del Open de China (ATP 500 masculino, WTA 1000 femenino).
const ranking = new Map([['3754', { pos: 25, puntos: 1900 }]])
const todos: PartidoTenis[] = fixture.events.flatMap((e) => partidosDesdeEvento(e, ranking))
const shanghai = todos.filter((p) => /Shanghai/.test(p.torneoNombre))
const alcaraz = shanghai.find((p) => /Alcaraz/.test(p.a.nombre + p.b.nombre))!

describe('torneoEs', () => {
  it('reconoce Masters, WTA 1000, Grand Slam y Finals según el cuadro', () => {
    expect(torneoEs('Rolex Shanghai Masters', false, 'atp')).toMatchObject({ categoria: 'masters', corto: 'Masters de Shanghái', superficie: 'pista dura' })
    expect(torneoEs('China Open', false, 'wta')).toMatchObject({ categoria: '1000', corto: 'WTA 1000 de Pekín' })
    expect(torneoEs('China Open', false, 'atp').categoria).toBe('otro')
    expect(torneoEs('Roland Garros', true, 'atp')).toMatchObject({ categoria: 'slam', superficie: 'tierra batida' })
    expect(torneoEs('Nitto ATP Finals', false, 'atp').categoria).toBe('finals')
  })
})

describe('partidosDesdeEvento', () => {
  it('solo individuales de cuadro final, con la ronda en español', () => {
    expect(todos.every((p) => !/qualif/i.test(p.ronda))).toBe(true)
    expect(new Set(shanghai.map((p) => p.ronda))).toEqual(new Set(['primera ronda', 'segunda ronda', 'tercera ronda', 'octavos de final', 'cuartos de final', 'semifinales', 'final']))
  })

  it('pone primero a Alcaraz y lee cabeza de serie, ranking, país y hora', () => {
    expect(alcaraz.a.nombre).toBe('Carlos Alcaraz')
    expect(alcaraz.a).toMatchObject({ pais: 'España', hispano: true, cabeza: 2 })
    expect(alcaraz.b).toMatchObject({ nombre: 'Juan Manuel Cerundolo', pais: 'Argentina' })
    expect(alcaraz).toMatchObject({ ronda: 'segunda ronda', horaFija: true, estado: 'pre', sede: 'Shanghái', cuadro: 'masculino' })
    expect(refTenis(alcaraz)).toMatch(/^tennis_atp_\d+$/)
  })

  it('separa el Open de China por cuadros', () => {
    const fem = todos.filter((p) => /China Open/.test(p.torneoNombre) && p.cuadro === 'femenino')
    expect(fem.length).toBeGreaterThan(0)
    expect(fem.every((p) => p.gira === 'wta' && p.torneo.categoria === '1000')).toBe(true)
  })
})

describe('esPartidoImportante', () => {
  it('Alcaraz siempre, con la máxima prioridad', () => {
    expect(esPartidoImportante(alcaraz)).toMatchObject({ si: true, motivo: 'partido de Alcaraz', prioridad: 20 })
  })
  it('no, si un rival está por decidir', () => {
    const tbd = shanghai.find((p) => p.rondaOrden === 7)!
    expect(esPartidoImportante(tbd)).toMatchObject({ si: false, motivo: 'rivales por decidir' })
  })
  it('final de un ATP 500 sin hispanos: no; con un hispano: sí', () => {
    const fin = todos.find((p) => /China Open/.test(p.torneoNombre) && p.cuadro === 'masculino' && p.rondaOrden === 7)!
    expect(fin.estado).toBe('post')
    expect(esPartidoImportante(fin).si).toBe(false)
    expect(esPartidoImportante({ ...fin, b: { ...fin.b, hispano: true } }).si).toBe(true)
  })
  it('un hispano en cuartos de un Masters: sí; en tercera ronda: no', () => {
    const p = shanghai.find((x) => x.estado === 'post' && x.rondaOrden === 2)!
    const h = { ...p, a: { ...p.a, hispano: true, nombre: 'Jaume Munar' }, b: { ...p.b, nombre: 'Otro' } }
    expect(esPartidoImportante({ ...h, rondaOrden: 5, ronda: 'cuartos de final' }).si).toBe(true)
    expect(esPartidoImportante({ ...h, rondaOrden: 3 }).si).toBe(false)
  })
})

describe('dossier', () => {
  it('marcador con tie-break desde el ganador', () => {
    const p = shanghai.find((x) => /Bublik/.test(x.a.nombre + x.b.nombre) && /Machac/.test(x.a.nombre + x.b.nombre))!
    const [g, per] = p.a.ganador ? [p.a, p.b] : [p.b, p.a]
    expect(g.nombre).toBe('Alexander Bublik')
    expect(marcador(g, per)).toBe('6-4, 7-6 (7-4)')
    // Un set perdido en el tie-break se escribe al revés: 6-7 (3-7).
    const q = shanghai.find((x) => /Berrettini/.test(x.a.nombre + x.b.nombre) && /Kovacevic/.test(x.a.nombre + x.b.nombre))!
    const [g2, p2] = q.a.ganador ? [q.a, q.b] : [q.b, q.a]
    expect(marcador(g2, p2)).toBe('6-7 (3-7), 6-1, 6-4')
  })

  it('previa: horas de España y Latinoamérica, camino y lo que NO consta', () => {
    const { datos, texto } = construirDossierTenis(alcaraz, 'previa', todos)
    expect(texto).toContain('Masters 1000 de Shanghái')
    expect(texto).toMatch(/hacia las 12:00 hora peninsular española/)
    expect(texto).toContain('Buenos Aires')
    expect(texto).toMatch(/Carlos Alcaraz: debuta en el torneo en esta ronda/)
    expect(texto).toMatch(/Juan Manuel Cerundolo: primera ronda: venció a Nicolas Mejia por 6-4, 6-4/)
    expect(texto).toContain('NO CONSTAN: el cara a cara')
    expect(datos).toMatchObject({ sport: 'tenis', home: 'Carlos Alcaraz', competicion: 'Masters de Shanghái', horaFija: true })
  })

  it('crónica: ganador, marcador y campeón en la final', () => {
    const fin = todos.find((p) => /China Open/.test(p.torneoNombre) && p.cuadro === 'masculino' && p.rondaOrden === 7)!
    const { texto } = construirDossierTenis(fin, 'cronica', todos)
    expect(texto).toMatch(/RESULTADO: GANÓ .+ por \d-\d/)
    expect(texto).toMatch(/es el CAMPEÓN del China Open/)
  })
})

describe('apellido (titulares SEO de tenis)', () => {
  it('se queda con el apellido, partículas incluidas', () => {
    expect(apellido('Carlos Alcaraz')).toBe('Alcaraz')
    expect(apellido('Juan Manuel Cerundolo')).toBe('Cerundolo')
    expect(apellido('Alex de Minaur')).toBe('de Minaur')
    expect(apellido('Sinner')).toBe('Sinner')
  })
})
