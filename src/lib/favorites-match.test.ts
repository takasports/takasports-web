import { describe, it, expect } from 'vitest'
import { nameMatch } from './quiniela'

// ─────────────────────────────────────────────────────────────────────────────
// Emparejamiento de FAVORITOS (❤). isFavorite (CalendarioContent) y el filtro
// "Mis equipos" del Inicio (LiveEventsSection) delegan en nameMatch de la quiniela
// — por PALABRA COMPLETA + alias + sin acentos — en vez del antiguo "contiene
// texto". Estos tests fijan que la lista curada del onboarding (FavoritesOnboarding
// POPULAR_TEAMS) sigue casando su nombre en el feed (ESPN/Sanity) y que los falsos
// positivos del substring quedan eliminados. Si un equipo del onboarding deja de
// casar, hay que añadir su alias en TEAM_ALIASES (quiniela.ts).
// ─────────────────────────────────────────────────────────────────────────────

describe('favoritos — equipos del onboarding SÍ casan su nombre del feed', () => {
  const casos: [string, string][] = [
    // Nombre curado del onboarding  →  nombre tal como llega en el evento
    ['Barcelona', 'FC Barcelona'],
    ['Real Madrid', 'Real Madrid'],
    ['Atlético Madrid', 'Atlético de Madrid'],
    ['Real Betis', 'Real Betis Balompié'],
    ['Alavés', 'Alaves'],                       // sin tilde en el feed
    ['Athletic Club', 'Athletic Club'],
    ['Manchester City', 'Man City'],            // apodo por alias
    ['Newcastle United', 'Newcastle'],
    ['Tottenham', 'Tottenham Hotspur'],
    ['West Ham', 'West Ham United'],
    ['Wolverhampton', 'Wolverhampton Wanderers'],
    ['Brighton', 'Brighton & Hove Albion'],
    ['Inter', 'Inter Milan'],
    ['Roma', 'AS Roma'],
    ['AC Milan', 'Milan'],
    ['Bayern', 'Bayern Munich'],
    ['Dortmund', 'Borussia Dortmund'],
    ['Leverkusen', 'Bayer Leverkusen'],
    ['Frankfurt', 'Eintracht Frankfurt'],
    ['Gladbach', 'Borussia Mönchengladbach'],
    ['RB Leipzig', 'Leipzig'],
    ['PSG', 'Paris Saint-Germain'],
    ['Lyon', 'Olympique Lyonnais'],
    ['Marseille', 'Olympique de Marseille'],
    ['Monaco', 'AS Monaco'],
    ['Lakers', 'Los Angeles Lakers'],           // apodo NBA = token del nombre completo
    ['Celtics', 'Boston Celtics'],
    ['Warriors', 'Golden State Warriors'],
    ['Heat', 'Miami Heat'],
    ['Alcaraz', 'Carlos Alcaraz'],              // tenis: apellido = token
    ['Djokovic', 'Novak Djokovic'],
    ['McGregor', 'Conor McGregor'],             // UFC: apellido = token
  ]
  for (const [fav, evento] of casos) {
    it(`«${fav}» ↔ «${evento}»`, () => {
      expect(nameMatch(fav, evento)).toBe(true)
    })
  }
})

describe('favoritos — falsos positivos del substring quedan ELIMINADOS', () => {
  const noCasan: [string, string][] = [
    ['Inter', 'Inter Miami'],       // Serie A ≠ MLS (antes casaba por 'inter')
    ['Milan', 'Inter Milan'],       // 'Milan'→AC Milan, no el Inter (antes casaba)
    ['Roma', 'Romania'],            // subcadena 'roma' ⊄ selección (antes casaba)
    ['Como', 'Comoros'],            // subcadena 'como' (antes casaba)
    ['Getafe', 'Real Madrid'],      // control: equipos distintos
    ['Betis', 'Real Sociedad'],     // control: comparten token 'real' tras alias, no casan
  ]
  for (const [fav, evento] of noCasan) {
    it(`«${fav}» ⊄ «${evento}»`, () => {
      expect(nameMatch(fav, evento)).toBe(false)
    })
  }
})
