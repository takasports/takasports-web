export type StandingZone =
  | 'champions' | 'europa' | 'conference'   // continental (1ª división / Sudamérica / Asia)
  | 'promotion' | 'promotion_playoff'        // ascenso (2ª división)
  | 'playoffs'                               // playoffs de liga (MLS, etc.)
  | 'relegation_playoff' | 'relegation'      // descenso

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

// ESPN incluye en cada fila de su clasificación una nota de cualificación
// (`entries[].note.description`) precisa y que se actualiza sola por temporada y
// coeficiente UEFA. La preferimos sobre las reglas hardcodeadas (que solo cubren
// las 5 grandes y envejecen). Mapea la descripción de ESPN a nuestra zona visual.
// Si no reconoce la nota devuelve undefined → sin zona, nunca una zona errónea.
export function zoneFromNote(description?: string | null): StandingZone | undefined {
  if (!description) return undefined
  const d = description.toLowerCase()
  const isPlayoff = /play[\s-]?off/.test(d)
  // Descenso (incluye "Relegation playoff/playoffs")
  if (d.includes('relegation')) return isPlayoff ? 'relegation_playoff' : 'relegation'
  // Ascenso de 2ª división ("Promotion", "Promotion playoffs")
  if (d.includes('promotion')) return isPlayoff ? 'promotion_playoff' : 'promotion'
  // Competiciones continentales (Europa) — cubre "... qualifying"
  if (d.includes('champions league')) return 'champions'
  if (d.includes('europa league')) return 'europa'
  if (d.includes('conference league')) return 'conference'
  // Sudamérica
  if (d.includes('libertadores')) return 'champions'
  if (d.includes('sudamericana') || d.includes('sudamericano')) return 'europa'
  // Asia (AFC) — "Elite" = principal, "Two" = secundaria
  if (d.includes('afc champions league two')) return 'europa'
  if (d.includes('afc champions')) return 'champions'
  // Playoffs de liga (MLS Cup Playoffs, Wild Card, Liguilla…)
  if (isPlayoff || d.includes('wild card') || d.includes('liguilla') || d.includes('play-in')) return 'playoffs'
  return undefined
}
