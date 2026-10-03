import { describe, expect, it } from 'vitest'
import { citaDestacada, fichaVisual, montarDestacado, montarPiezasPartido, partirParrafosLargos } from '@/lib/partido-visual'

const summary = {
  header: { competitions: [{ status: { type: { completed: true, state: 'post' } }, competitors: [
    { homeAway: 'home', score: '6', team: { id: '471', displayName: 'Poland', logos: [{ href: 'https://a.espncdn.com/pol.png' }] } },
    { homeAway: 'away', score: '0', team: { id: '473', displayName: 'Romania', logos: [{ href: 'https://a.espncdn.com/rom.png' }] } },
  ] }] },
  keyEvents: [
    { clock: { displayValue: "47'" }, type: { text: 'Goal' }, team: { id: '471' }, participants: [{ athlete: { displayName: 'Robert Lewandowski' } }, { athlete: { displayName: 'Nicola Zalewski' } }] },
    { clock: { displayValue: "22'" }, type: { text: 'Red Card' }, team: { id: '473' }, participants: [{ athlete: { displayName: 'Radu Dragusin' } }] },
    { clock: { displayValue: "24'" }, type: { text: 'Penalty - Scored' }, team: { id: '471' }, participants: [{ athlete: { displayName: 'Robert Lewandowski' } }] },
    { clock: { displayValue: "49'" }, type: { text: 'Own Goal' }, team: { id: '471' }, participants: [{ athlete: { displayName: 'Virgil Ghita' } }] },
    { clock: { displayValue: "35'" }, type: { text: 'Yellow Card' }, team: { id: '473' }, participants: [{ athlete: { displayName: 'Virgil Ghita' } }] },
    { clock: { displayValue: "45'+1'" }, type: { text: 'Halftime' } },
  ],
  boxscore: { teams: [
    { team: { id: '471' }, statistics: [{ name: 'possessionPct', displayValue: '66.8' }, { name: 'totalShots', displayValue: '24' }, { name: 'shotsOnTarget', displayValue: '9' }, { name: 'wonCorners', displayValue: '7' }] },
    { team: { id: '473' }, statistics: [{ name: 'possessionPct', displayValue: '33.2' }, { name: 'totalShots', displayValue: '10' }, { name: 'shotsOnTarget', displayValue: '3' }, { name: 'wonCorners', displayValue: '1' }] },
  ] },
  standings: { groups: [{ standings: { entries: [
    { id: '466', team: 'Sweden', stats: [{ name: 'rank', displayValue: '1' }, { name: 'points', displayValue: '7' }, { name: 'gamesPlayed', displayValue: '3' }, { name: 'pointDifferential', displayValue: '+3' }] },
    { id: '471', team: 'Poland', stats: [{ name: 'rank', displayValue: '3' }, { name: 'points', displayValue: '4' }, { name: 'gamesPlayed', displayValue: '3' }, { name: 'pointDifferential', displayValue: '+4' }] },
  ] } }] },
}

const bloque = (style: string, text: string, k: string) => ({ _type: 'block', _key: k, style, children: [{ _type: 'span', _key: k + 's', text, marks: [] }] })

describe('fichaVisual', () => {
  const f = fichaVisual(summary)!
  it('nombres en español, marcador y eventos en orden con el tipo correcto', () => {
    expect(f.home.nombre).toBe('Polonia')
    expect(f.away.nombre).toBe('Rumanía')
    expect([f.home.goles, f.away.goles]).toEqual([6, 0])
    expect(f.eventos.map((e) => `${e.minuto} ${e.tipo} ${e.jugador}`)).toEqual([
      "22' roja Radu Dragusin", "24' penalti Robert Lewandowski", "47' gol Robert Lewandowski", "49' propia Virgil Ghita",
    ])
    expect(f.eventos[2].asistencia).toBe('Nicola Zalewski')
  })
  it('las amarillas y el descanso no son eventos del marcador', () => {
    expect(f.eventos.some((e) => e.jugador === 'Virgil Ghita' && e.tipo === 'roja')).toBe(false)
  })
  it('estadísticas y clasificación con los dos equipos marcados', () => {
    expect(f.estadisticas[0]).toEqual({ label: 'Posesión', home: 66.8, away: 33.2, unit: '%' })
    expect(f.clasificacion.find((x) => x.destacado)?.equipo).toBe('Polonia')
  })
  it('sin partido acabado no hay marcador ni estadísticas', () => {
    const vivo = JSON.parse(JSON.stringify(summary))
    vivo.header.competitions[0].status.type = { completed: false, state: 'pre' }
    const g = fichaVisual(vivo)!
    expect(g.home.goles).toBeNull()
    expect(g.estadisticas).toEqual([])
  })
})

describe('montarPiezasPartido', () => {
  const cuerpo = [
    bloque('normal', 'Entradilla uno.', 'a'), bloque('normal', 'Entradilla dos.', 'b'),
    bloque('h2', 'Los números del partido', 'c'), bloque('normal', 'Texto.', 'd'),
    bloque('h2', 'Qué cambia en la clasificación', 'e'), bloque('normal', 'Texto.', 'f'),
    bloque('h2', 'Ficha del partido', 'g'),
  ]
  it('marcador tras la entradilla, estadísticas y clasificación bajo su sección', () => {
    const out = montarPiezasPartido(cuerpo, fichaVisual(summary)!, 'cronica').map((b) => b._type === 'block' ? b._key : b._type)
    expect(out).toEqual(['a', 'b', 'partidoMarcador', 'c', 'statChart', 'd', 'e', 'partidoClasificacion', 'f', 'g'])
  })
})

describe('partirParrafosLargos', () => {
  const largo = Array.from({ length: 12 }, (_, i) => `Esta es la frase número ${i + 1} del párrafo, con algo de texto.`).join(' ')
  it('parte por un final de frase cerca de la mitad', () => {
    const out = partirParrafosLargos([bloque('normal', largo, 'p')])
    expect(out).toHaveLength(2)
    expect(String(out[0].children![0].text).endsWith('.')).toBe(true)
    expect(String(out[1].children![0].text)).toMatch(/^Esta es la frase/)
  })
  it('no toca párrafos con enlaces ni cortos', () => {
    const conMarca = { ...bloque('normal', largo, 'q'), children: [{ _type: 'span', text: largo, marks: ['m1'] }] }
    expect(partirParrafosLargos([conMarca, bloque('normal', 'Corto.', 'r')])).toHaveLength(2)
  })
})

describe('destacado', () => {
  it('solo declaraciones: presentadas con dos puntos o seguidas de un verbo de habla', () => {
    const exp = [bloque('normal', 'Fue un debut «el más raro de la historia reciente de SmackDown» para ella.', 'a')]
    expect(citaDestacada(exp)).toBeNull()
    const dec = [bloque('normal', '«Nos ha faltado profundidad en los últimos treinta metros del campo», lamentó Zidane tras el partido.', 'a')]
    expect(citaDestacada(dec)).toMatchObject({ autor: 'Zidane' })
    const recta = [bloque('normal', 'El técnico fue claro: "nos ha faltado profundidad en los últimos 30 metros, que es donde se crea el peligro". Y añadió otra cosa.', 'a')]
    expect(citaDestacada(recta)?.texto).toMatch(/^Nos ha faltado/)
    // Dos citas rectas seguidas: nunca se empareja el cierre de una con la apertura de la otra.
    const dos = [bloque('normal', 'Dijo "una frase corta" y luego explicó: "esta es la declaración larga que de verdad merece salir destacada en la nota".', 'a')]
    expect(citaDestacada(dos)?.texto).toMatch(/^Esta es la declaración/)
  })
  it('se inserta dos párrafos por debajo de la cita', () => {
    const cuerpo = [
      bloque('normal', 'Uno.', '1'), bloque('normal', 'Zidane habló: «Nos ha faltado profundidad en los últimos treinta metros del campo».', '2'),
      bloque('normal', 'Tres.', '3'), bloque('normal', 'Cuatro.', '4'), bloque('normal', 'Cinco.', '5'), bloque('normal', 'Seis.', '6'),
    ]
    const out = montarDestacado(cuerpo).map((b) => b._type === 'block' ? b._key : b._type)
    expect(out).toEqual(['1', '2', '3', '4', 'destacado', '5', '6'])
  })
})
