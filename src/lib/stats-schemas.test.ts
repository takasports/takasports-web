import { describe, it, expect, vi } from 'vitest'
import { espnStandingsSchema, jolpicaDriverStandingsSchema, safeParse } from './stats-schemas'

describe('safeParse', () => {
  it('parses valid ESPN standings', () => {
    const json = {
      children: [{
        standings: {
          entries: [{
            team: { displayName: 'Real Madrid', abbreviation: 'RMA' },
            stats: [{ name: 'wins', value: 22 }],
          }],
        },
      }],
    }
    const r = safeParse(espnStandingsSchema, json, 'test')
    expect(r?.children?.[0]?.standings?.entries).toHaveLength(1)
  })

  it('returns null and warns on shape drift', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = safeParse(espnStandingsSchema, { children: 'not-an-array' }, 'test')
    expect(r).toBeNull()
    warn.mockRestore()
  })

  it('parses Jolpica F1 driver standings minimal shape', () => {
    const json = {
      MRData: {
        StandingsTable: {
          StandingsLists: [{
            season: '2026',
            round: '7',
            DriverStandings: [{
              position: '1', points: '162', wins: '4',
              Driver: { givenName: 'Lando', familyName: 'Norris', code: 'NOR' },
              Constructors: [{ name: 'McLaren', constructorId: 'mclaren' }],
            }],
          }],
        },
      },
    }
    const r = safeParse(jolpicaDriverStandingsSchema, json, 'test')
    expect(r?.MRData?.StandingsTable?.StandingsLists?.[0]?.season).toBe('2026')
  })
})
