import { describe, it, expect } from 'vitest'
import {
  matchCachePolicy, matchCacheHeaders,
  LIVE_POLICY, PREMATCH_POLICY, UPCOMING_POLICY, FINAL_POLICY,
} from './match-cache'

const KICKOFF = '2026-10-21T19:00:00Z'
const at = (iso: string) => Date.parse(iso)

describe('matchCachePolicy', () => {
  it('en juego: 15 s de borde y swr corto (el de 60 s servía respuestas de hasta 75 s)', () => {
    for (const s of ['STATUS_FIRST_HALF', 'STATUS_SECOND_HALF', 'STATUS_HALFTIME', 'STATUS_IN_PROGRESS', 'STATUS_SHOOTOUT']) {
      expect(matchCachePolicy(s, KICKOFF, at('2026-10-21T19:30:00Z'))).toEqual(LIVE_POLICY)
    }
    expect(LIVE_POLICY.sMaxAge).toBe(15)
    expect(LIVE_POLICY.swr).toBeLessThanOrEqual(5)
  })

  it('estado desconocido o vacío → directo (nunca se sobre-cachea)', () => {
    expect(matchCachePolicy(undefined, undefined)).toEqual(LIVE_POLICY)
    expect(matchCachePolicy('STATUS_RARO', KICKOFF)).toEqual(LIVE_POLICY)
  })

  it('final del tiempo reglamentario NO es final: puede venir prórroga', () => {
    expect(matchCachePolicy('STATUS_END_OF_REGULATION', KICKOFF, at('2026-10-21T20:50:00Z'))).toEqual(LIVE_POLICY)
  })

  it('terminado → 1 h', () => {
    for (const s of ['STATUS_FULL_TIME', 'STATUS_FINAL', 'STATUS_FINAL_PEN', 'STATUS_FINAL_AET', 'STATUS_CANCELED']) {
      expect(matchCachePolicy(s, KICKOFF, at('2026-10-21T21:00:00Z'))).toEqual(FINAL_POLICY)
    }
  })

  it('programado lejos del saque → 5 min, como siempre', () => {
    expect(matchCachePolicy('STATUS_SCHEDULED', KICKOFF, at('2026-10-21T12:00:00Z'))).toEqual(UPCOMING_POLICY)
    expect(matchCachePolicy('STATUS_SCHEDULED', undefined)).toEqual(UPCOMING_POLICY)
    expect(matchCachePolicy('STATUS_SCHEDULED', 'no-es-fecha')).toEqual(UPCOMING_POLICY)
  })

  it('en las 2 h previas → 2 min (alineaciones a tiempo)', () => {
    expect(matchCachePolicy('STATUS_SCHEDULED', KICKOFF, at('2026-10-21T17:00:00Z'))).toEqual(PREMATCH_POLICY)
    expect(matchCachePolicy('STATUS_PRE_GAME', KICKOFF, at('2026-10-21T18:30:00Z'))).toEqual(PREMATCH_POLICY)
  })

  it('desde 10 min antes, y si el saque pasó sin que ESPN cambie el estado → directo', () => {
    expect(matchCachePolicy('STATUS_SCHEDULED', KICKOFF, at('2026-10-21T18:50:00Z'))).toEqual(LIVE_POLICY)
    expect(matchCachePolicy('STATUS_SCHEDULED', KICKOFF, at('2026-10-21T19:05:00Z'))).toEqual(LIVE_POLICY)
  })
})

describe('matchCacheHeaders', () => {
  it('misma política en Cache-Control y CDN-Cache-Control', () => {
    expect(matchCacheHeaders(LIVE_POLICY)).toEqual({
      'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=5',
      'CDN-Cache-Control': 'public, s-maxage=15, stale-while-revalidate=5',
    })
  })
})
