import { describe, it, expect } from 'vitest'
import {
  buildEntityIndex, autolinkSegments, createAutolinkContext, teamAliases,
  MAX_AUTOLINKS_PER_ARTICLE,
} from './article-autolink'

const TEAMS = [
  { name: 'Real Madrid', teamId: '86', leagueSlug: 'soccer/esp.1' },
  { name: 'Barcelona', teamId: '83', leagueSlug: 'soccer/esp.1' },
  { name: 'Atlético Madrid', teamId: '1068', leagueSlug: 'soccer/esp.1' },
  { name: 'Manchester City', teamId: '382', leagueSlug: 'soccer/eng.1' },
  { name: 'Arsenal', teamId: '359', leagueSlug: 'soccer/eng.1' },
  { name: 'Paris Saint-Germain', teamId: '160', leagueSlug: 'soccer/uefa.champions' },
  { name: 'Como', teamId: '2572', leagueSlug: 'soccer/ita.1' },
  { name: 'Los Angeles Lakers', teamId: '13', leagueSlug: 'basketball/nba' },
  // Mismo club en liga y Champions: una sola entrada.
  { name: 'Real Madrid', teamId: '86', leagueSlug: 'soccer/uefa.champions' },
]
const PLAYERS = [
  { name: 'Kylian Mbappé', playerId: '231388', leagueSlug: 'soccer/esp.1' },
]

const links = (text: string, sport: string | null = 'futbol', index = buildEntityIndex(TEAMS, PLAYERS)) =>
  autolinkSegments(text, index, createAutolinkContext(sport))
    .filter(s => s.type === 'link')
    .map(s => [s.text, s.url])

describe('buildEntityIndex', () => {
  it('mete los equipos de las clasificaciones con su slug canónico', () => {
    const idx = buildEntityIndex(TEAMS, PLAYERS)
    expect(idx.byKey['real madrid']?.url).toBe('/equipo/real-madrid-86')
    expect(idx.byKey['barcelona']?.url).toBe('/equipo/barcelona-83')
    expect(idx.byKey['kylian mbappe']?.url).toBe('/jugador/kylian-mbappe-231388')
  })

  it('añade alias en español y el apodo NBA apuntando a la misma ficha', () => {
    const idx = buildEntityIndex(TEAMS, PLAYERS)
    expect(idx.byKey['atletico de madrid']?.url).toBe('/equipo/atletico-madrid-1068')
    expect(idx.byKey['psg']?.url).toBe('/equipo/paris-saint-germain-160')
    expect(idx.byKey['lakers']?.url).toBe('/equipo/los-angeles-lakers-13')
  })

  it('descarta nombres ambiguos o que son palabra corriente', () => {
    const idx = buildEntityIndex(TEAMS, PLAYERS)
    expect(idx.byKey['como']).toBeUndefined()
    expect(teamAliases('Orlando Magic', 'basketball/nba')).toEqual(['Magic'])
    const nba = buildEntityIndex([{ name: 'Orlando Magic', teamId: '19', leagueSlug: 'basketball/nba' }], [])
    expect(nba.byKey['magic']).toBeUndefined()
  })
})

describe('autolinkSegments con equipos', () => {
  it('enlaza equipo y jugador, una sola vez por entidad', () => {
    expect(links('El Real Madrid ganó con dos goles de Kylian Mbappé. El Real Madrid es líder.')).toEqual([
      ['Real Madrid', '/equipo/real-madrid-86'],
      ['Kylian Mbappé', '/jugador/kylian-mbappe-231388'],
    ])
  })

  it('alias y nombre oficial cuentan como la misma entidad', () => {
    expect(links('El Atlético de Madrid visita al Arsenal. Atlético Madrid llega invicto.')).toEqual([
      ['Atlético de Madrid', '/equipo/atletico-madrid-1068'],
      ['Arsenal', '/equipo/arsenal-359'],
    ])
  })

  it('no enlaza las piezas sueltas «Real», «City» ni «Atlético»', () => {
    expect(links('El Real jugó mejor que el City y el Atlético.')).toEqual([])
  })

  it('el nombre largo gana al corto: «Manchester City» entero', () => {
    expect(links('Ganó el Manchester City.')).toEqual([['Manchester City', '/equipo/manchester-city-382']])
  })

  it('«en Barcelona» es la ciudad; «el Barcelona», el club', () => {
    expect(links('La final se juega en Barcelona.')).toEqual([])
    expect(links('La final se juega en Barcelona y el Barcelona la quiere.')).toEqual([
      ['Barcelona', '/equipo/barcelona-83'],
    ])
  })

  it('no enlaza dentro de un enlace o una URL ya escritos', () => {
    expect(links('Ver [la crónica del Real Madrid](https://x.com) hoy.')).toEqual([])
    expect(links('Fuente: https://www.marca.com/futbol/Barcelona.html')).toEqual([])
  })

  it('respeta el deporte del artículo', () => {
    expect(links('Los Lakers y el Real Madrid.', 'baloncesto')).toEqual([['Lakers', '/equipo/los-angeles-lakers-13']])
    expect(links('Los Lakers y el Real Madrid.', 'futbol')).toEqual([['Real Madrid', '/equipo/real-madrid-86']])
  })

  it('no pasa del tope de enlaces por artículo', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `Equipo Número ${String.fromCharCode(65 + i)}`, teamId: String(i + 1), leagueSlug: 'soccer/esp.1' }))
    const idx = buildEntityIndex(many, [])
    const text = many.map(t => `${t.name} ganó.`).join(' ')
    expect(links(text, 'futbol', idx)).toHaveLength(MAX_AUTOLINKS_PER_ARTICLE)
  })
})
