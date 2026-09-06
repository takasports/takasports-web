import { describe, it, expect } from 'vitest'
import { parseOfficialRank, cleanSubtitle, labelSubtitle, entryTitle, entryDescription } from './rankings-seo'

// Bio real de una entrada de `periodistas`: el motivo de que exista labelSubtitle.
const BIO_LARGA = '51 años en el periodismo. Director de Planeta Fútbol (Win Sports). El decano de Colombia.'

describe('parseOfficialRank', () => {
  it('saca el puesto de los subtitles reales de tenis', () => {
    expect(parseOfficialRank('ATP #48 · Tenis')).toEqual({ org: 'ATP', num: 48 })
    expect(parseOfficialRank('WTA #1 · Tenis')).toEqual({ org: 'WTA', num: 1 })
    expect(parseOfficialRank('ATP #13 · Tenis')).toEqual({ org: 'ATP', num: 13 })
  })

  it('tolera la ausencia de espacio y el espacio de más', () => {
    expect(parseOfficialRank('ATP#48 · Tenis')).toEqual({ org: 'ATP', num: 48 })
    expect(parseOfficialRank('  WTA  #84 · Tenis')).toEqual({ org: 'WTA', num: 84 })
  })

  it('generaliza a otros organismos sin tocar el código', () => {
    expect(parseOfficialRank('UFC #7 · Peso pluma')).toEqual({ org: 'UFC', num: 7 })
  })

  it('devuelve null para los subtitles que NO son un ranking', () => {
    expect(parseOfficialRank('Premier League · Inglaterra')).toBeNull()
    expect(parseOfficialRank('NBA · Oeste')).toBeNull()
    expect(parseOfficialRank('WWE · Luchador profesional')).toBeNull()
    expect(parseOfficialRank('Tenis · YouTube / TikTok')).toBeNull()
    expect(parseOfficialRank('Formula 1 · Constructores')).toBeNull()
  })

  it('no se traga la cadena literal "null" que llega de la vista', () => {
    expect(parseOfficialRank('null')).toBeNull()
    expect(parseOfficialRank(undefined)).toBeNull()
    expect(parseOfficialRank('')).toBeNull()
  })

  it('exige que el ranking vaya al principio, no a media frase', () => {
    expect(parseOfficialRank('Tenis · ATP #48')).toBeNull()
  })

  it('rechaza el puesto 0 y lo que no es número', () => {
    expect(parseOfficialRank('ATP #0 · Tenis')).toBeNull()
    expect(parseOfficialRank('ATP #? · Tenis')).toBeNull()
  })
})

describe('cleanSubtitle', () => {
  it('limpia los valores basura', () => {
    expect(cleanSubtitle('null')).toBeNull()
    expect(cleanSubtitle('   ')).toBeNull()
    expect(cleanSubtitle(undefined)).toBeNull()
    expect(cleanSubtitle('NBA · Este')).toBe('NBA · Este')
  })
})

describe('entryTitle', () => {
  it('pone el puesto oficial delante — es lo que se buscó', () => {
    expect(entryTitle({ name: 'Denis Shapovalov', subtitle: 'ATP #48 · Tenis' }))
      .toBe('Denis Shapovalov · ATP #48 — ranking y forma | TakaSports')
  })

  it('cabe en lo que Google enseña (~60 caracteres) en el caso típico', () => {
    const t = entryTitle({ name: 'Denis Shapovalov', subtitle: 'ATP #48 · Tenis' })
    // El nombre y el puesto —lo que decide el clic— entran antes del corte.
    expect(t.indexOf('| TakaSports')).toBeLessThanOrEqual(60)
  })

  it('sin ranking oficial usa el subtitle, que sigue siendo más útil que la nota', () => {
    expect(entryTitle({ name: 'Manchester City', subtitle: 'Premier League · Inglaterra' }))
      .toBe('Manchester City · Premier League · Inglaterra | TakaSports')
  })

  it('aguanta un subtitle inservible sin dejar puntuación colgando', () => {
    expect(entryTitle({ name: 'KOlmenero', subtitle: 'null' }))
      .toBe('KOlmenero | TakaSports')
  })

  it('NO mete la biografía de un periodista en el título', () => {
    const t = entryTitle({ name: 'Carlos Antonio Vélez', subtitle: BIO_LARGA, category: 'periodistas' })
    expect(t).toBe('Carlos Antonio Vélez · Periodista deportivo | TakaSports')
    expect(t.length).toBeLessThan(60)
  })

  it('una bio larga sin categoría conocida se cae del título en vez de desbordarlo', () => {
    expect(entryTitle({ name: 'Alguien', subtitle: BIO_LARGA }))
      .toBe('Alguien | TakaSports')
  })
})

describe('labelSubtitle', () => {
  it('acepta las etiquetas cortas tal cual', () => {
    expect(labelSubtitle('LaLiga · España', 'clubes')).toBe('LaLiga · España')
    expect(labelSubtitle('WWE · YouTube (661K suscriptores)', 'creadores_wwe'))
      .toBe('WWE · YouTube (661K suscriptores)')
  })

  it('rechaza la prosa y cae a la etiqueta de categoría', () => {
    expect(labelSubtitle(BIO_LARGA, 'creadores')).toBe('Creador de contenido')
  })

  it('rechaza también lo que es corto pero son dos frases', () => {
    expect(labelSubtitle('Es bueno. Muy bueno.', 'periodistas')).toBe('Periodista deportivo')
  })
})

describe('entryDescription', () => {
  it('confirma el dato buscado y añade lo que la ficha aporta', () => {
    expect(entryDescription({ name: 'Denis Shapovalov', subtitle: 'ATP #48 · Tenis', insight: '' }, 70.4))
      .toBe('Denis Shapovalov es el número 48 del ranking ATP. Forma reciente, evolución semanal y su nota en el Índice Taka: 70,4/100.')
  })

  it('el ranking oficial gana al insight editorial', () => {
    const d = entryDescription(
      { name: 'Rafael Jodar', subtitle: 'ATP #13 · Tenis', insight: 'Irrumpe en el circuito.' },
      82.9,
    )
    expect(d).toContain('número 13 del ranking ATP')
  })

  it('sin ranking oficial manda el insight editorial', () => {
    expect(entryDescription({ name: 'Arsenal', subtitle: 'Premier League · Inglaterra', insight: 'Aguanta el pulso arriba.' }, 88))
      .toBe('Aguanta el pulso arriba.')
  })

  it('sin insight cae al subtitle con la nota en formato español', () => {
    expect(entryDescription({ name: 'Arsenal', subtitle: 'Premier League · Inglaterra', insight: '' }, 88.25))
      .toBe('Premier League · Inglaterra. Ranking Taka 88,3/100.')
  })

  it('sin insight NI subtitle sigue diciendo algo', () => {
    expect(entryDescription({ name: 'KOlmenero', subtitle: 'null', insight: '' }, 61))
      .toBe('KOlmenero en el Ranking Taka: 61,0/100.')
  })

  it('no deja doble punto cuando el subtitle ya acaba en punto', () => {
    const d = entryDescription({ name: 'Carlos Antonio Vélez', subtitle: BIO_LARGA, insight: '' }, 74.2)
    expect(d).not.toContain('..')
    expect(d).toContain('El decano de Colombia. Ranking Taka 74,2/100.')
  })
})
