import { describe, it, expect } from 'vitest'
import { FOOTBALL_LEAGUES, FOOTBALL_LEAGUE_SLUGS } from './football-leagues'

describe('FOOTBALL_LEAGUE_SLUGS', () => {
  it('deriva de la lista maestra sin perder ni duplicar competiciones', () => {
    expect(FOOTBALL_LEAGUE_SLUGS.size).toBe(FOOTBALL_LEAGUES.length)
  })

  it('incluye las competiciones que el sitio muestra', () => {
    for (const slug of ['soccer/esp.1', 'soccer/eng.1', 'soccer/bra.1', 'soccer/uefa.champions']) {
      expect(FOOTBALL_LEAGUE_SLUGS.has(slug)).toBe(true)
    }
  })

  // Este es el guardarraíl que decide qué entra en la cola de fotos del cron: si alguna de
  // estas colara, volveríamos a meter decenas de miles de jugadores que nadie mira y los
  // cracks se quedarían esperando detrás (ver listEntitiesNeedingImage).
  it('deja fuera las competiciones que NO mostramos', () => {
    for (const slug of [
      'soccer/usa.ncaa.w.1',      // fútbol universitario femenino de EE.UU. — 6.000 pendientes
      'soccer/eng.5',             // quinta división inglesa
      'soccer/club.friendly',     // amistosos de club
      'soccer/bra.camp.gaucho',   // campeonato regional brasileño
      'soccer/sco.tennents',
    ]) {
      expect(FOOTBALL_LEAGUE_SLUGS.has(slug)).toBe(false)
    }
  })
})
