export type StandingZone = 'champions' | 'europa' | 'conference' | 'relegation_playoff' | 'relegation'

const LEAGUE_ZONES: Record<string, Array<{ from: number; to: number; zone: StandingZone }>> = {
  'soccer/esp.1': [
    { from: 1, to: 4, zone: 'champions' }, { from: 5, to: 6, zone: 'europa' },
    { from: 7, to: 7, zone: 'conference' }, { from: 18, to: 20, zone: 'relegation' },
  ],
  'soccer/eng.1': [
    { from: 1, to: 4, zone: 'champions' }, { from: 5, to: 6, zone: 'europa' },
    { from: 7, to: 7, zone: 'conference' }, { from: 18, to: 20, zone: 'relegation' },
  ],
  'soccer/ita.1': [
    { from: 1, to: 4, zone: 'champions' }, { from: 5, to: 6, zone: 'europa' },
    { from: 7, to: 7, zone: 'conference' }, { from: 18, to: 20, zone: 'relegation' },
  ],
  'soccer/ger.1': [
    { from: 1, to: 4, zone: 'champions' }, { from: 5, to: 6, zone: 'europa' },
    { from: 7, to: 7, zone: 'conference' }, { from: 16, to: 16, zone: 'relegation_playoff' },
    { from: 17, to: 18, zone: 'relegation' },
  ],
  'soccer/fra.1': [
    { from: 1, to: 3, zone: 'champions' }, { from: 4, to: 4, zone: 'champions' },
    { from: 5, to: 6, zone: 'europa' }, { from: 7, to: 7, zone: 'conference' },
    { from: 15, to: 15, zone: 'relegation_playoff' }, { from: 16, to: 18, zone: 'relegation' },
  ],
}

export function getZone(leagueSlug: string, rank: number): StandingZone | undefined {
  return LEAGUE_ZONES[leagueSlug]?.find(r => rank >= r.from && rank <= r.to)?.zone
}
