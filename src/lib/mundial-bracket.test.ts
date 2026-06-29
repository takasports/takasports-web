import { describe, it, expect } from 'vitest'
import { buildBracket, type BracketSourceEvent } from './mundial-bracket'

// Los 32 partidos REALES de la fase final del Mundial 2026, extraídos de
// ranked_events (sport='mundial') el 2026-06-29. Mezcla equipos ya definidos
// (dieciseisavos) y huecos de ESPN ("Round of 32 3 Winner", "Semifinal 1 Loser").
const KO: BracketSourceEvent[] = [
  // Dieciseisavos (16) — equipos reales
  ev('1',  '2026-06-28T19:00:00Z', 'South Africa', 'Canada', 'resolved', { winner: '2', home_score: 0, away_score: 2 }),
  ev('2',  '2026-06-29T17:00:00Z', 'Brazil', 'Japan'),
  ev('3',  '2026-06-29T20:30:00Z', 'Germany', 'Paraguay'),
  ev('4',  '2026-06-30T01:00:00Z', 'Netherlands', 'Morocco'),
  ev('5',  '2026-06-30T17:00:00Z', 'Ivory Coast', 'Norway'),
  ev('6',  '2026-06-30T21:00:00Z', 'France', 'Sweden'),
  ev('7',  '2026-07-01T01:00:00Z', 'Mexico', 'Ecuador'),
  ev('8',  '2026-07-01T16:00:00Z', 'England', 'Congo DR'),
  ev('9',  '2026-07-01T20:00:00Z', 'Belgium', 'Senegal'),
  ev('10', '2026-07-02T00:00:00Z', 'United States', 'Bosnia-Herzegovina'),
  ev('11', '2026-07-02T19:00:00Z', 'Spain', 'Austria'),
  ev('12', '2026-07-02T23:00:00Z', 'Portugal', 'Croatia'),
  ev('13', '2026-07-03T03:00:00Z', 'Switzerland', 'Algeria'),
  ev('14', '2026-07-03T18:00:00Z', 'Australia', 'Egypt'),
  ev('15', '2026-07-03T22:00:00Z', 'Argentina', 'Cape Verde'),
  ev('16', '2026-07-04T01:30:00Z', 'Colombia', 'Ghana'),
  // Octavos (8) — el primero ya tiene un finalista propagado por ESPN
  ev('17', '2026-07-04T17:00:00Z', 'Canada', 'Round of 32 3 Winner'),
  ev('18', '2026-07-04T21:00:00Z', 'Round of 32 2 Winner', 'Round of 32 5 Winner'),
  ev('19', '2026-07-05T20:00:00Z', 'Round of 32 4 Winner', 'Round of 32 6 Winner'),
  ev('20', '2026-07-06T00:00:00Z', 'Round of 32 7 Winner', 'Round of 32 8 Winner'),
  ev('21', '2026-07-06T19:00:00Z', 'Round of 32 11 Winner', 'Round of 32 12 Winner'),
  ev('22', '2026-07-07T00:00:00Z', 'Round of 32 9 Winner', 'Round of 32 10 Winner'),
  ev('23', '2026-07-07T16:00:00Z', 'Round of 32 14 Winner', 'Round of 32 16 Winner'),
  ev('24', '2026-07-07T20:00:00Z', 'Round of 32 13 Winner', 'Round of 32 15 Winner'),
  // Cuartos (4)
  ev('25', '2026-07-09T20:00:00Z', 'Round of 16 1 Winner', 'Round of 16 2 Winner'),
  ev('26', '2026-07-10T19:00:00Z', 'Round of 16 5 Winner', 'Round of 16 6 Winner'),
  ev('27', '2026-07-11T21:00:00Z', 'Round of 16 3 Winner', 'Round of 16 4 Winner'),
  ev('28', '2026-07-12T01:00:00Z', 'Round of 16 7 Winner', 'Round of 16 8 Winner'),
  // Semifinales (2)
  ev('29', '2026-07-14T19:00:00Z', 'Quarterfinal 1 Winner', 'Quarterfinal 2 Winner'),
  ev('30', '2026-07-15T19:00:00Z', 'Quarterfinal 3 Winner', 'Quarterfinal 4 Winner'),
  // Tercer puesto (1) — perdedores de semis
  ev('31', '2026-07-18T21:00:00Z', 'Semifinal 1 Loser', 'Semifinal 2 Loser'),
  // Final (1)
  ev('32', '2026-07-19T19:00:00Z', 'Semifinal 1 Winner', 'Semifinal 2 Winner'),
]

function ev(
  id: string, date: string, home: string | null, away: string | null,
  status: BracketSourceEvent['status'] = 'open', result: BracketSourceEvent['result'] = null,
): BracketSourceEvent {
  return { id, event_date: date, team_home: home, team_away: away, status, result }
}

describe('buildBracket', () => {
  it('reparte los 32 partidos en las 6 rondas con los tamaños del formato 48', () => {
    const b = buildBracket(KO)
    expect(b.rounds.map(r => r.id)).toEqual(['r32', 'r16', 'qf', 'sf', 'third', 'final'])
    expect(b.rounds.map(r => r.matches.length)).toEqual([16, 8, 4, 2, 1, 1])
    expect(b.totalCount).toBe(32)
  })

  it('toma los ÚLTIMOS 32 cuando se le pasa el calendario completo (grupos + KO)', () => {
    // 72 partidos de grupos (anteriores) + los 32 KO → debe ignorar los de grupos.
    const grupos: BracketSourceEvent[] = Array.from({ length: 72 }, (_, i) =>
      ev(`g${i}`, `2026-06-${String(11 + (i % 15)).padStart(2, '0')}T12:00:00Z`, 'Spain', 'Brazil'))
    const b = buildBracket([...grupos, ...KO])
    expect(b.totalCount).toBe(32)
    expect(b.rounds[0].matches[0].home.name).toBe('Sudáfrica') // primer dieciseisavo real, no un grupo
  })

  it('traduce las selecciones a español y les pone bandera', () => {
    const b = buildBracket(KO)
    const first = b.rounds[0].matches[1] // Brazil vs Japan
    expect(first.home.name).toBe('Brasil')
    expect(first.home.flag).toBe('🇧🇷')
    expect(first.away.name).toBe('Japón')
    expect(first.home.isPlaceholder).toBe(false)
  })

  it('convierte los huecos de ESPN en texto ES con su conexión', () => {
    const b = buildBracket(KO)
    const oct = b.rounds[1].matches[0] // Canada vs "Round of 32 3 Winner"
    expect(oct.home.isPlaceholder).toBe(false)
    expect(oct.home.name).toBe('Canadá')
    expect(oct.away.isPlaceholder).toBe(true)
    expect(oct.away.name).toBe('Ganador 16avos 3')
    expect(oct.away.sourceRound).toBe('r32')
    expect(oct.away.sourceSlot).toBe(3)
    expect(oct.away.flag).toBe('🏳️')
  })

  it('marca el partido por el tercer puesto como perdedores de semifinales', () => {
    const b = buildBracket(KO)
    const third = b.rounds[4]
    expect(third.id).toBe('third')
    expect(third.label).toBe('Tercer puesto')
    expect(third.matches).toHaveLength(1)
    expect(third.matches[0].home.name).toBe('Perdedor semis 1')
    expect(third.matches[0].away.name).toBe('Perdedor semis 2')
  })

  it('la final son los ganadores de semifinales', () => {
    const b = buildBracket(KO)
    const final = b.rounds[5].matches[0]
    expect(final.home.name).toBe('Ganador semis 1')
    expect(final.away.name).toBe('Ganador semis 2')
  })

  it('marca el ganador y el marcador en partidos resueltos', () => {
    const b = buildBracket(KO)
    const m = b.rounds[0].matches[0] // South Africa 0-2 Canada (resolved)
    expect(m.status).toBe('resolved')
    expect(m.home.score).toBe(0)
    expect(m.away.score).toBe(2)
    expect(m.away.isWinner).toBe(true)
    expect(m.home.isWinner).toBe(false)
  })

  it('cuenta los resueltos y detecta que la eliminatoria ya arrancó', () => {
    const b = buildBracket(KO)
    expect(b.resolvedCount).toBe(1)
    expect(b.hasStarted).toBe(true)
  })
})
