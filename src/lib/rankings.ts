// Índice Taka — datos actualizados a 2026-05-05
// Pondera: rendimiento · estadística · influencia mediática · percepción pública
//
// ── METODOLOGÍA DE PUNTUACIÓN (0–100) ────────────────────────────────────────
//
//  A) Rendimiento reciente (35 %)
//     Forma últimas 5–10 actuaciones: stats objetivas (goles, asistencias,
//     rating Sofascore/WhoScored), impacto directo en victorias/derrotas.
//
//  B) Contexto y temporada (25 %)
//     Nivel de la competición, posición del equipo, presencia en grandes
//     torneos (Champions, Playoffs, Mundiales). No es lo mismo rendir en
//     LaLiga que en una liga secundaria.
//
//  C) Influencia mediática (25 %)
//     Menciones en medios, Google Trends, followers + engagement en redes,
//     cobertura internacional vs. local.
//
//  D) Narrativa y percepción pública (15 %)
//     Momentos virales, arco narrativo (ascenso/caída/polémica/querido),
//     impacto en cultura pop. Factor editorial — refleja el «momento».
//
//  Modificadores especiales:
//    · badge 'Histórico'  → multiplicador de legado (+techo mínimo ~80)
//    · badge 'Revelación' → multiplicador de potencial (penaliza menos la falta
//                           de trayectoria)
//    · trend 'up2/down2'  → variación ≥ 3 puntos respecto al período anterior

export type Trend = 'up2' | 'up' | 'flat' | 'down' | 'down2'
export type RankingTab = 'jugadores' | 'clubes' | 'entrenadores' | 'creadores' | 'periodistas'
export type RankingRegion = 'global' | 'europa' | 'latam' | 'concacaf' | 'sub21'

export interface RankingEntry {
  id: string
  rank: number
  name: string
  subtitle: string       // equipo, cargo, medio…
  sport?: string         // slug canónico para filtrar
  score: number          // 0–100
  trend: Trend
  insight: string        // frase breve editorial
  emoji?: string         // avatar rápido si no hay foto
  image?: string         // URL/ruta de imagen real (curada manualmente). Si existe, prevalece sobre el emoji.
  badge?: string         // 'Nuevo' | 'Histórico' | 'Revelación'
  region?: RankingRegion
  country?: string       // nacionalidad (flag emoji)
  featured?: boolean     // zona destacados fuera del top 10
  league?: string        // liga/competición para filtrar
  position?: string      // posición del jugador
  gender?: 'f'           // solo presente en entradas femeninas
  scorePrev?: number     // score del período anterior — permite calcular trend automáticamente
  scoreSport?: number    // score específico del deporte (rendimiento-heavy) — usado cuando hay filtro de deporte
  rankSport?: number     // posición dentro del deporte — usado cuando hay filtro de deporte
  trendReason?: string   // razón del movimiento (aparece como tooltip)
  factors?: {            // desglose editorial de la puntuación
    rendimiento: number  // forma reciente + stats (35 %)
    contexto:    number  // nivel competición + contexto equipo (25 %)
    mediatico:   number  // followers, menciones, alcance global (25 %)
    narrativa:   number  // momentos virales, arco narrativo (15 %)
  }
  editorialBoost?: number  // ajuste subjetivo Taka (-15 a +15) — requiere editorialNote
  editorialNote?: string   // razón del ajuste editorial visible al usuario
  category?: string        // jugadores | clubes | entrenadores | etc. — disponible para entradas de DB
  _globalRank?: number     // rank original antes de re-rank por filtro (interno UI)
}

// Calcula trend automáticamente cuando hay scorePrev
export function calcTrend(score: number, scorePrev: number): Trend {
  const diff = score - scorePrev
  if (diff >= 3)  return 'up2'
  if (diff >= 1)  return 'up'
  if (diff <= -3) return 'down2'
  if (diff <= -1) return 'down'
  return 'flat'
}

// Calcula el Índice Taka desde factores objetivos + ajuste editorial subjetivo
// Fórmula: rendimiento×0.35 + contexto×0.25 + mediático×0.25 + narrativa×0.15 + editorialBoost
export function calcScore(
  factors: NonNullable<RankingEntry['factors']>,
  editorialBoost?: number
): number {
  const base =
    factors.rendimiento * 0.35 +
    factors.contexto    * 0.25 +
    factors.mediatico   * 0.25 +
    factors.narrativa   * 0.15
  const total = base + (editorialBoost ?? 0)
  return Math.round(Math.max(0, Math.min(100, total)) * 10) / 10
}

// ── JUGADORES — GLOBAL ────────────────────────────────────────────
export const RANKING_JUGADORES: RankingEntry[] = [
  {
    id: 'dembele', rank: 1, name: 'Ousmane Dembélé', subtitle: 'Paris Saint-Germain · Extremo',
    sport: 'futbol', score: 96.8, trend: 'up2', region: 'europa', badge: 'Nuevo',
    insight: 'Balón de Oro 2025. Líder absoluto del PSG que arrasó con cuádruplete histórico (Ligue 1, Copa, Champions y Trofeo de Campeones).',
    emoji: '🇫🇷', country: '🇫🇷', league: 'ligue1', position: 'extremo',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Ousmane_Demb%C3%A9l%C3%A9_2018_%28cropped%29.jpg/330px-Ousmane_Demb%C3%A9l%C3%A9_2018_%28cropped%29.jpg',
    scorePrev: 88.0, trendReason: 'Balón de Oro 2025 + cuádruplete con PSG y goleador en la final 5-0 al Inter en Múnich',
    factors: { rendimiento: 99, contexto: 98, mediatico: 95, narrativa: 96 },
    editorialBoost: 0.5, editorialNote: 'Año perfecto: Balón de Oro y máximo goleador del PSG en la Champions ganada',
  },
  {
    id: 'yamal', rank: 2, name: 'Lamine Yamal', subtitle: 'FC Barcelona · Extremo',
    sport: 'futbol', score: 94.6, trend: 'up', region: 'europa', badge: 'Revelación',
    insight: 'Subcampeón del Balón de Oro con 18 años. Cara del nuevo Barça campeón de LaLiga y proyecto generacional sin precedente.',
    emoji: '🇪🇸', country: '🇪🇸', league: 'laliga', position: 'extremo',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Lamine_Yamal_in_2025.jpg/330px-Lamine_Yamal_in_2025.jpg',
    scorePrev: 91.7, trendReason: 'Segundo en el Balón de Oro 2025 — pero lesión muscular en abril le deja fuera del cierre de temporada',
    factors: { rendimiento: 95, contexto: 93, mediatico: 96, narrativa: 97 },
  },
  {
    id: 'mbappe', rank: 3, name: 'Kylian Mbappé', subtitle: 'Real Madrid · Delantero',
    sport: 'futbol', score: 93.5, trend: 'down', region: 'europa',
    insight: 'Pichichi 2024/25 con 31 goles en su debut blanco. La adaptación inicial al Madrid se convirtió en consagración goleadora.',
    emoji: '🇫🇷', country: '🇫🇷', league: 'laliga', position: 'delantero',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Picture_with_Mbapp%C3%A9_%28cropped_and_rotated%29.jpg/330px-Picture_with_Mbapp%C3%A9_%28cropped_and_rotated%29.jpg',
    scorePrev: 94.8, trendReason: 'Pichichi y máquina de gol en Madrid pero el equipo se quedó fuera de Champions y LaLiga',
    factors: { rendimiento: 94, contexto: 91, mediatico: 98, narrativa: 92 },
  },
  {
    id: 'salah', rank: 4, name: 'Mohamed Salah', subtitle: 'Liverpool · Extremo',
    sport: 'futbol', score: 92.0, trend: 'up2', region: 'europa', badge: 'Histórico',
    insight: 'Bota de Oro de la Premier 24/25 con 29 goles, cuarta de su carrera —iguala a Thierry Henry— y campeón con el Liverpool de Slot.',
    emoji: '🇪🇬', country: '🇪🇬', league: 'premier', position: 'extremo',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Mohamed_Salah_2018.jpg/330px-Mohamed_Salah_2018.jpg',
    scorePrev: 71.5, trendReason: 'Premier League + Bota de Oro + 4º en el Balón de Oro 2025: temporada de leyenda en Anfield',
    factors: { rendimiento: 96, contexto: 92, mediatico: 88, narrativa: 90 },
  },
  {
    id: 'sinner', rank: 5, name: 'Jannik Sinner', subtitle: 'ATP #1 · Tenis',
    sport: 'tenis', score: 91.2, trend: 'up', region: 'europa',
    insight: 'Número 1 del mundo con margen amplio. Wimbledon 2025 ante Alcaraz y campeón en Madrid 2026: dominio sostenido del circuito.',
    emoji: '🇮🇹', country: '🇮🇹', league: 'atp',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Jannik_Sinner_2025_US_Open.jpg/330px-Jannik_Sinner_2025_US_Open.jpg',
    scorePrev: 83.8, trendReason: 'Wimbledon 2025 + Mutua Madrid 2026: amplía ventaja sobre Alcaraz al frente de la ATP',
    factors: { rendimiento: 95, contexto: 90, mediatico: 89, narrativa: 90 },
  },
  {
    id: 'alcaraz', rank: 6, name: 'Carlos Alcaraz', subtitle: 'ATP #2 · Tenis',
    sport: 'tenis', score: 90.6, trend: 'up2', region: 'europa',
    insight: 'Career Grand Slam con 22 años tras ganar el Australian Open 2026. El más joven de la historia en completarlo.',
    emoji: '🇪🇸', country: '🇪🇸', league: 'atp',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Carlos_Alcaraz_2025_FO.jpg/330px-Carlos_Alcaraz_2025_FO.jpg',
    scorePrev: 86.2, trendReason: 'Roland Garros 2025 + Australian Open 2026: career slam más joven de la historia del tenis',
    factors: { rendimiento: 93, contexto: 89, mediatico: 90, narrativa: 95 },
  },
  {
    id: 'sga', rank: 7, name: 'Shai Gilgeous-Alexander', subtitle: 'OKC Thunder · Base',
    sport: 'baloncesto', score: 90.3, trend: 'up2',
    insight: 'MVP regular y MVP de las Finales 2025: primer jugador en lograrlo en el mismo año desde LeBron 2013. Anillo NBA con Thunder.',
    emoji: '🇨🇦', country: '🇨🇦', region: 'concacaf', league: 'nba', position: 'base',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Shai_Gilgeous-Alexander_-_Thunder_vs._Wizards.png/330px-Shai_Gilgeous-Alexander_-_Thunder_vs._Wizards.png',
    scorePrev: 88.3, trendReason: 'Doblete histórico: MVP regular + MVP Finales con anillo NBA del Thunder, primer título desde 1979',
    factors: { rendimiento: 98, contexto: 92, mediatico: 84, narrativa: 92 },
  },
  {
    id: 'vitinha', rank: 8, name: 'Vitinha', subtitle: 'Paris Saint-Germain · Pivote',
    sport: 'futbol', score: 89.7, trend: 'up2', region: 'europa',
    insight: 'El cerebro del PSG del cuádruplete. Top 5 en el Balón de Oro 2025 y referencia mundial del centrocampo organizador.',
    emoji: '🇵🇹', country: '🇵🇹', league: 'ligue1', position: 'pivote',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Vitinha_USMNT_v_Portugal_Mar_31_2026-50.jpg/330px-Vitinha_USMNT_v_Portugal_Mar_31_2026-50.jpg',
    scorePrev: 55.5, trendReason: 'Cerebro del PSG del cuádruplete histórico — top 5 del Balón de Oro 2025',
    factors: { rendimiento: 93, contexto: 95, mediatico: 78, narrativa: 87 },
  },
  {
    id: 'norris', rank: 9, name: 'Lando Norris', subtitle: 'McLaren · Piloto F1',
    sport: 'formula1', score: 88.9, trend: 'up2', region: 'europa',
    insight: 'Campeón del mundo de F1 2025 por dos puntos sobre Verstappen en Abu Dabi. Primer título de McLaren para piloto desde 2008.',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/330px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg',
    scorePrev: 78.3, trendReason: 'Campeón del mundo 2025 — primer título tras 17 años de sequía en McLaren',
    factors: { rendimiento: 92, contexto: 90, mediatico: 86, narrativa: 90 },
  },
  {
    id: 'hakimi', rank: 10, name: 'Achraf Hakimi', subtitle: 'Paris Saint-Germain · Lateral',
    sport: 'futbol', score: 87.8, trend: 'up2', region: 'europa',
    insight: 'Goleador en la final de Champions 5-0 ante el Inter. Top 6 del Balón de Oro y el lateral más decisivo del fútbol mundial.',
    emoji: '🇲🇦', country: '🇲🇦', league: 'ligue1', position: 'defensa',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Achraf_Hakimi_%28cropped%29.jpg/330px-Achraf_Hakimi_%28cropped%29.jpg',
    scorePrev: 70.0, trendReason: 'Goleador en la final de Champions 5-0 al Inter — top 6 del Balón de Oro 2025',
    factors: { rendimiento: 92, contexto: 92, mediatico: 80, narrativa: 86 },
  },
  {
    id: 'aspinall', rank: 11, name: 'Tom Aspinall', subtitle: 'UFC · Campeón Pesado Indiscutido',
    sport: 'ufc', score: 87.1, trend: 'up2', region: 'europa', badge: 'Nuevo',
    insight: 'Campeón indiscutido de los pesos pesados tras la retirada de Jon Jones en junio 2025. La nueva era de la división reina.',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Tom_Aspinall_UFC_295_%28cropped%29.jpg/330px-Tom_Aspinall_UFC_295_%28cropped%29.jpg',
    scorePrev: 70.0, trendReason: 'Campeón indiscutido tras la retirada de Jon Jones — nueva era del peso pesado',
    factors: { rendimiento: 89, contexto: 88, mediatico: 82, narrativa: 90 },
  },
  {
    id: 'topuria', rank: 12, name: 'Ilia Topuria', subtitle: 'UFC · Campeón Ligero',
    sport: 'ufc', score: 86.8, trend: 'up2', region: 'europa', badge: 'Nuevo',
    insight: 'Doble campeón en pluma y ligero. El primer luchador hispanohablante en dominar dos divisiones distintas en la UFC.',
    emoji: '🇪🇸', country: '🇪🇸',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Ilia_Topuria_at_the_Orbeliani_Palace_%28cropped%29.jpg/330px-Ilia_Topuria_at_the_Orbeliani_Palace_%28cropped%29.jpg',
    scorePrev: 65.0, trendReason: 'Doble campeón pluma y ligero — primer hispanohablante con dos cinturones distintos UFC',
    factors: { rendimiento: 91, contexto: 86, mediatico: 84, narrativa: 89 },
  },
  {
    id: 'rory', rank: 13, name: 'Rory McIlroy', subtitle: 'PGA Tour · Golf',
    sport: 'golf', score: 86.5, trend: 'up2', region: 'europa', badge: 'Histórico',
    insight: 'Bicampeón consecutivo del Masters de Augusta (2025 y 2026). Se une a Nicklaus, Faldo y Tiger en el club selecto del back-to-back.',
    emoji: '🇮🇪', country: '🇮🇪',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Rory_McIlroy_Ryder_Cup_2025-195_%28cropped%29.jpg/330px-Rory_McIlroy_Ryder_Cup_2025-195_%28cropped%29.jpg',
    scorePrev: 70.0, trendReason: 'Back-to-back en el Masters 2025 y 2026 — solo Nicklaus, Faldo y Tiger lo habían logrado',
    factors: { rendimiento: 90, contexto: 87, mediatico: 84, narrativa: 90 },
  },
  {
    id: 'jokic', rank: 14, name: 'Nikola Jokić', subtitle: 'Denver Nuggets · Pívot',
    sport: 'baloncesto', score: 86.0, trend: 'down', region: 'europa', badge: 'Histórico',
    insight: 'Triple-doble de promedio en regular season pero los Nuggets cayeron en primera ronda. El estándar estadístico sigue siendo suyo.',
    emoji: '🇷🇸', country: '🇷🇸', league: 'nba', position: 'pivote',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Nikola_Jokic_free_throw_%28cropped%29.jpg/330px-Nikola_Jokic_free_throw_%28cropped%29.jpg',
    scorePrev: 89.6, trendReason: 'Promedios MVP pero eliminado en primera ronda — segundo en la votación del MVP detrás de SGA',
    factors: { rendimiento: 95, contexto: 78, mediatico: 84, narrativa: 86 },
  },
  {
    id: 'wemba', rank: 15, name: 'Victor Wembanyama', subtitle: 'San Antonio Spurs · Pívot',
    sport: 'baloncesto', score: 85.8, trend: 'up2', region: 'europa', badge: 'Revelación',
    insight: 'Récord de 12 tapones en un solo partido de playoffs ante los Wolves. Con los Spurs como segundo cabeza de serie del Oeste.',
    emoji: '🇫🇷', country: '🇫🇷', league: 'nba', position: 'pivote',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Victor_Wembanyama_San_Antonio_Spurs_2024.jpg/330px-Victor_Wembanyama_San_Antonio_Spurs_2024.jpg',
    scorePrev: 80.6, trendReason: 'Récord de 12 tapones en G1 de semifinales — los Spurs entre los favoritos del Oeste',
    factors: { rendimiento: 90, contexto: 84, mediatico: 84, narrativa: 90 },
  },
  {
    id: 'reigns', rank: 16, name: 'Roman Reigns', subtitle: 'WWE · Campeón Mundial Heavyweight',
    sport: 'wwe', score: 85.3, trend: 'up2', region: 'concacaf', badge: 'Histórico',
    insight: 'Recuperó el World Heavyweight Championship en WrestleMania 42 a CM Punk. El Tribal Chief vuelve al main event.',
    emoji: '🧿', country: '🇺🇸', position: 'masculino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Roman_Reigns_RR25_%281%29_%28headshot%29.jpg/330px-Roman_Reigns_RR25_%281%29_%28headshot%29.jpg',
    scorePrev: 78.0, trendReason: 'Vence a CM Punk en el main event de WrestleMania 42 y recupera el World Heavyweight Championship',
    factors: { rendimiento: 86, contexto: 86, mediatico: 88, narrativa: 90 },
  },
  {
    id: 'antonelli', rank: 17, name: 'Kimi Antonelli', subtitle: 'Mercedes · Piloto F1',
    sport: 'formula1', score: 85.0, trend: 'up2', region: 'europa', badge: 'Revelación',
    insight: 'Líder del Mundial 2026 con dos victorias en cuatro carreras. El italiano de 19 años redefine el inicio de la nueva era F1.',
    emoji: '🇮🇹', country: '🇮🇹',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Kimi_Antonelli_at_the_2025_US_Grand_Prix_in_Austin%2C_TX_%28cropped%29.jpg/330px-Kimi_Antonelli_at_the_2025_US_Grand_Prix_in_Austin%2C_TX_%28cropped%29.jpg',
    scorePrev: 60.0, trendReason: 'Líder del Mundial 2026 con dos victorias en las primeras cuatro carreras de la nueva era reglamentaria',
    factors: { rendimiento: 91, contexto: 84, mediatico: 80, narrativa: 92 },
  },
  {
    id: 'cody-rhodes', rank: 18, name: 'Cody Rhodes', subtitle: 'WWE · Campeón Indiscutible',
    sport: 'wwe', score: 84.6, trend: 'flat', region: 'concacaf',
    insight: 'Retuvo el Undisputed WWE Championship ante Randy Orton en WrestleMania 42. La cara más estable de la WWE moderna.',
    emoji: '🇺🇸', country: '🇺🇸', position: 'masculino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Cody_Rhodes_Fort_Bragg_Army_250_Birthday_Celebration_%28headshot%29.jpg/330px-Cody_Rhodes_Fort_Bragg_Army_250_Birthday_Celebration_%28headshot%29.jpg',
    scorePrev: 85.2, trendReason: 'Retiene el Undisputed WWE Title en WrestleMania 42 ante Randy Orton — referencia consolidada',
    factors: { rendimiento: 86, contexto: 84, mediatico: 84, narrativa: 87 },
  },
  {
    id: 'verstappen', rank: 19, name: 'Max Verstappen', subtitle: 'Red Bull Racing · Piloto F1',
    sport: 'formula1', score: 84.2, trend: 'down', region: 'europa', badge: 'Histórico',
    insight: 'Subcampeón del mundo 2025 por solo dos puntos —margen más ajustado desde 2010—. Cuatro títulos consecutivos previos.',
    emoji: '🇳🇱', country: '🇳🇱',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg/330px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg',
    scorePrev: 86.9, trendReason: 'Pierde el título 2025 por dos puntos en Abu Dabi — final de la era Verstappen como campeón',
    factors: { rendimiento: 88, contexto: 84, mediatico: 86, narrativa: 80 },
  },
  {
    id: 'pereira', rank: 20, name: 'Alex Pereira', subtitle: 'UFC · Campeón Semipesado',
    sport: 'ufc', score: 83.7, trend: 'up', region: 'latam',
    insight: 'Recuperó el cinturón semipesado ante Ankalaev en UFC 320. Estrella mediática global del MMA y posible salto a pesado.',
    emoji: '🇧🇷', country: '🇧🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Alex_Pereira_UFC_300.png/330px-Alex_Pereira_UFC_300.png',
    scorePrev: 75.0, trendReason: 'Recupera el cinturón semipesado vs Ankalaev en UFC 320 — sondea salto a pesado',
    factors: { rendimiento: 87, contexto: 83, mediatico: 87, narrativa: 84 },
  },
  {
    id: 'rodri', rank: 21, name: 'Rodri', subtitle: 'Manchester City · Pivote',
    sport: 'futbol', score: 82.7, trend: 'down', region: 'europa', badge: 'Histórico',
    insight: 'Vuelta progresiva tras la lesión grave de rodilla. Balón de Oro 2024 vigente pero City sin títulos esta temporada.',
    emoji: '🇪🇸', country: '🇪🇸', league: 'premier', position: 'pivote',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/RODRI_-_SWE_vs_ESP_-_UEFA_EURO_2020_QUALIFIERS_-_2019.10.15_%28cropped%29.jpg/330px-RODRI_-_SWE_vs_ESP_-_UEFA_EURO_2020_QUALIFIERS_-_2019.10.15_%28cropped%29.jpg',
    scorePrev: 90.2, trendReason: 'Vuelta lenta tras lesión y City sin títulos — pierde protagonismo en la votación 2025',
    factors: { rendimiento: 80, contexto: 84, mediatico: 84, narrativa: 84 },
  },
  {
    id: 'rhea-ripley', rank: 22, name: 'Rhea Ripley', subtitle: 'WWE · Campeona Femenina',
    sport: 'wwe', score: 82.4, trend: 'up2', region: 'europa', badge: 'Revelación',
    insight: 'Recuperó el WWE Women\'s Championship a Jade Cargill en WrestleMania 42. La luchadora más dominante del wrestling actual.',
    emoji: '🌹', country: '🇦🇺', position: 'femenino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Rhea_Ripley_040724_%28cropped%29.jpg/330px-Rhea_Ripley_040724_%28cropped%29.jpg',
    scorePrev: 78.0, trendReason: 'Recupera el Women\'s Championship a Jade Cargill en WrestleMania 42 — vuelve a reinar',
    factors: { rendimiento: 87, contexto: 82, mediatico: 82, narrativa: 88 },
  },
  {
    id: 'haaland', rank: 23, name: 'Erling Haaland', subtitle: 'Manchester City · Delantero',
    sport: 'futbol', score: 81.8, trend: 'down2', region: 'europa',
    insight: '22 goles en Premier antes de lesionarse el tobillo. Temporada interrumpida con City fuera del título y de Champions.',
    emoji: '🇳🇴', country: '🇳🇴', league: 'premier', position: 'delantero',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Erling_Haaland_June_2025.jpg/330px-Erling_Haaland_June_2025.jpg',
    scorePrev: 96.4, trendReason: 'Lesión grave de tobillo en abril + City sin Premier ni Champions: peor temporada como goleador',
    factors: { rendimiento: 84, contexto: 78, mediatico: 88, narrativa: 78 },
  },
  {
    id: 'bellingham', rank: 24, name: 'Jude Bellingham', subtitle: 'Real Madrid · Centrocampista',
    sport: 'futbol', score: 81.0, trend: 'down', region: 'europa',
    insight: 'Temporada irregular con el Madrid de Arbeloa tras el caos del banquillo. Líder en cancha pese a la inestabilidad del proyecto.',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', league: 'laliga', position: 'centrocampista',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Jude_Bellingham_-_240422_190551-2_%28cropped%29.jpg/330px-25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Jude_Bellingham_-_240422_190551-2_%28cropped%29.jpg',
    scorePrev: 84.1, trendReason: 'Madrid en crisis con tres entrenadores en una temporada — Bellingham acusa la inestabilidad',
    factors: { rendimiento: 82, contexto: 80, mediatico: 82, narrativa: 78 },
  },
  {
    id: 'wirtz', rank: 25, name: 'Florian Wirtz', subtitle: 'Liverpool · Mediapunta',
    sport: 'futbol', score: 80.4, trend: 'up2', region: 'europa',
    insight: 'Fichaje récord británico (£116M) por el Liverpool campeón. Pieza clave del proyecto Slot tras el adiós de Klopp.',
    emoji: '🇩🇪', country: '🇩🇪', league: 'premier', position: 'mediapunta',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Florian_Wirtz%2C_2022-07-31%2C_Saisoner%C3%B6ffnung_Bayer_04%2C_Leverkusen_%281%29_%28cropped%29.jpg/330px-Florian_Wirtz%2C_2022-07-31%2C_Saisoner%C3%B6ffnung_Bayer_04%2C_Leverkusen_%281%29_%28cropped%29.jpg',
    scorePrev: 70.3, trendReason: 'Récord británico de transferencia: £116M al Liverpool campeón — debut en la Premier de élite',
    factors: { rendimiento: 84, contexto: 84, mediatico: 76, narrativa: 80 },
  },
  {
    id: 'doue', rank: 26, name: 'Désiré Doué', subtitle: 'Paris Saint-Germain · Mediapunta',
    sport: 'futbol', score: 79.8, trend: 'up2', region: 'europa', badge: 'Revelación',
    insight: 'MVP de la final de Champions con 19 años. La nueva joya del PSG ya forma parte del top 10 europeo absoluto.',
    emoji: '🇫🇷', country: '🇫🇷', league: 'ligue1', position: 'mediapunta',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Doue_asse_psg_2425.png/330px-Doue_asse_psg_2425.png',
    scorePrev: 60.0, trendReason: 'Player of the Match en la final de Champions 5-0 al Inter con 19 años',
    factors: { rendimiento: 84, contexto: 88, mediatico: 75, narrativa: 84 },
  },
  {
    id: 'jokic-prev', rank: 27, name: 'Jayson Tatum', subtitle: 'Boston Celtics · Alero',
    sport: 'baloncesto', score: 79.2, trend: 'down', region: 'concacaf',
    insight: 'Defensor del título tras el anillo de 2024. Celtics avanzan en playoffs 2026 pero ya no son los grandes favoritos.',
    emoji: '🇺🇸', country: '🇺🇸', league: 'nba', position: 'alero',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Celtics_at_Wizards_2024-12-044_%28cropped_2%29.jpg/330px-Celtics_at_Wizards_2024-12-044_%28cropped_2%29.jpg',
    scorePrev: 64.6, trendReason: 'Defensa del anillo y avance en playoffs 2026 — eclipsado por la era Thunder/SGA',
    factors: { rendimiento: 81, contexto: 80, mediatico: 76, narrativa: 80 },
  },
  {
    id: 'kvara', rank: 28, name: 'Khvicha Kvaratskhelia', subtitle: 'Paris Saint-Germain · Extremo',
    sport: 'futbol', score: 78.7, trend: 'up2', region: 'europa',
    insight: 'Goleador en la final de Champions y pieza clave del PSG del cuádruplete tras llegar del Nápoles en enero 2025.',
    emoji: '🇬🇪', country: '🇬🇪', league: 'ligue1', position: 'extremo',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Kvaratskhelia_asse_psg_2425.png/330px-Kvaratskhelia_asse_psg_2425.png',
    scorePrev: 65.0, trendReason: 'Goleador en la final de Champions y pieza decisiva del cuádruplete del PSG',
    factors: { rendimiento: 84, contexto: 86, mediatico: 72, narrativa: 78 },
  },
  {
    id: 'saka', rank: 29, name: 'Bukayo Saka', subtitle: 'Arsenal · Extremo',
    sport: 'futbol', score: 78.3, trend: 'up', region: 'europa',
    insight: 'Lleva al Arsenal a las semifinales de Champions ante el Atlético. La constancia hecho jugador en el proyecto Arteta.',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', league: 'premier', position: 'extremo',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/1_bukayo_saka_arsenal_2025_%28cropped%29.jpg/330px-1_bukayo_saka_arsenal_2025_%28cropped%29.jpg',
    scorePrev: 72.5, trendReason: 'Saka lidera al Arsenal hasta las semifinales de Champions 25/26 ante el Atlético de Madrid',
    factors: { rendimiento: 82, contexto: 84, mediatico: 72, narrativa: 74 },
  },
  {
    id: 'pedri', rank: 30, name: 'Pedri', subtitle: 'FC Barcelona · Centrocampista',
    sport: 'futbol', score: 78.0, trend: 'down', region: 'europa',
    insight: 'Indiscutible en el Barça campeón de LaLiga, pero las lesiones musculares siguen condicionando su explosión definitiva.',
    emoji: '🇪🇸', country: '🇪🇸', league: 'laliga', position: 'centrocampista',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Pedri.jpg/330px-Pedri.jpg',
    scorePrev: 82.1, trendReason: 'Lesiones musculares recurrentes — Barça campeón de LaLiga pese a sus ausencias',
    factors: { rendimiento: 80, contexto: 84, mediatico: 72, narrativa: 76 },
  },
  // ── Ranks 31–50 ──────────────────────────────────────────────────
  {
    id: 'sabalenka', rank: 31, name: 'Aryna Sabalenka', subtitle: 'WTA #1 · Tenis',
    sport: 'tenis', score: 77.6, trend: 'flat', region: 'europa',
    insight: '81 semanas consecutivas como número 1 del mundo. Finalista de Roland Garros 2025 y del Australian Open 2026.',
    emoji: '🇧🇾', country: '🇧🇾', league: 'atp',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Aryna_Sabalenka_Miami_Open_Final.jpg/330px-Aryna_Sabalenka_Miami_Open_Final.jpg',
    scorePrev: 78.0, trendReason: '81 semanas como WTA #1, finalista en RG 2025 y AO 2026 — dominio sostenido sin Grand Slam reciente',
    factors: { rendimiento: 82, contexto: 80, mediatico: 76, narrativa: 72 },
  },
  {
    id: 'rybakina', rank: 32, name: 'Elena Rybakina', subtitle: 'WTA #2 · Tenis',
    sport: 'tenis', score: 77.0, trend: 'up2', region: 'europa', badge: 'Revelación',
    insight: 'Australian Open 2026 conquistado tras ganar a Sabalenka. Ascenso al #2 mundial y ataque firme al trono WTA.',
    emoji: '🇰🇿', country: '🇰🇿', league: 'atp',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Elena_Rybakina_%282025_DC_Open%29_11_%28cropped%29.jpg/330px-Elena_Rybakina_%282025_DC_Open%29_11_%28cropped%29.jpg',
    scorePrev: 65.0, trendReason: 'Gana el Australian Open 2026 a Sabalenka — escala al #2 WTA con segundo Grand Slam',
    factors: { rendimiento: 86, contexto: 80, mediatico: 70, narrativa: 76 },
  },
  {
    id: 'lautaro', rank: 33, name: 'Lautaro Martínez', subtitle: 'Inter de Milán · Delantero',
    sport: 'futbol', score: 76.4, trend: 'down', region: 'latam',
    insight: 'Goleador y capitán pero la final de Champions perdida 0-5 dejó cicatriz. Inter sin Scudetto y con reconstrucción a la vista.',
    emoji: '🇦🇷', country: '🇦🇷', league: 'seriea', position: 'delantero',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Lautaro_Martinez_ARGENTINA_VS_VENEZUELA_2017.jpg/330px-Lautaro_Martinez_ARGENTINA_VS_VENEZUELA_2017.jpg',
    scorePrev: 69.8, trendReason: 'Final de Champions 0-5 perdida y Inter sin Scudetto — peor versión del capitán argentino',
    factors: { rendimiento: 80, contexto: 76, mediatico: 70, narrativa: 76 },
  },
  {
    id: 'gauff', rank: 34, name: 'Coco Gauff', subtitle: 'WTA #4 · Tenis',
    sport: 'tenis', score: 76.0, trend: 'up2', region: 'concacaf',
    insight: 'Roland Garros 2025 conquistado: primera estadounidense en ganar en París desde Serena Williams en 2015.',
    emoji: '🇺🇸', country: '🇺🇸', league: 'atp',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Coco_Gauff_Miami_Open.jpg/330px-Coco_Gauff_Miami_Open.jpg',
    scorePrev: 65.0, trendReason: 'Gana Roland Garros 2025 a Sabalenka — primera estadounidense en París desde Serena 2015',
    factors: { rendimiento: 82, contexto: 78, mediatico: 78, narrativa: 78 },
  },
  {
    id: 'djokovic', rank: 35, name: 'Novak Djokovic', subtitle: 'ATP #4 · Tenis',
    sport: 'tenis', score: 75.5, trend: 'down', region: 'europa', badge: 'Histórico',
    insight: '24 Grand Slams. Finalista del Australian Open 2026 ante Alcaraz: el GOAT sigue compitiendo al máximo nivel a los 38 años.',
    emoji: '🇷🇸', country: '🇷🇸', league: 'atp',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Novak_Djokovic_2024_Paris_Olympics.jpg/330px-Novak_Djokovic_2024_Paris_Olympics.jpg',
    scorePrev: 76.7, trendReason: 'Finalista AO 2026 ante Alcaraz — 38 años y todavía pelea por slams, pero sin levantar trofeos en 2025/26',
    factors: { rendimiento: 76, contexto: 76, mediatico: 80, narrativa: 80 },
    editorialBoost: 1.0, editorialNote: '24 Grand Slams — récord absoluto del tenis masculino',
  },
  {
    id: 'gunther', rank: 36, name: 'Gunther', subtitle: 'WWE · The Ring General',
    sport: 'wwe', score: 75.0, trend: 'up', region: 'europa',
    insight: 'El campeón más técnico de la WWE actual. Sus combates son la clase magistral de lucha europea clásica del roster.',
    emoji: '🏛️', country: '🇦🇹', position: 'masculino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Gunther_August_2024_%28headshot%29.jpg/330px-Gunther_August_2024_%28headshot%29.jpg',
    scorePrev: 81.5, trendReason: 'Sigue siendo el técnico más respetado de la WWE — pero perdió el cinturón mundial este año',
    factors: { rendimiento: 82, contexto: 76, mediatico: 70, narrativa: 78 },
  },
  {
    id: 'leao', rank: 37, name: 'Rafael Leão', subtitle: 'AC Milan · Extremo',
    sport: 'futbol', score: 74.4, trend: 'up', region: 'europa',
    insight: 'Velocidad y desequilibrio únicos en el calcio. Estrella indiscutida del AC Milan en su nueva fase competitiva.',
    emoji: '🇵🇹', country: '🇵🇹', league: 'seriea', position: 'extremo',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/RafaelLe%C3%A3oPortugal23.jpg/330px-RafaelLe%C3%A3oPortugal23.jpg',
    scorePrev: 62.4, trendReason: 'Mejor temporada en estadísticas con el Milan — figura referencial del calcio actual',
    factors: { rendimiento: 80, contexto: 74, mediatico: 70, narrativa: 74 },
  },
  {
    id: 'piastri', rank: 38, name: 'Oscar Piastri', subtitle: 'McLaren · Piloto F1',
    sport: 'formula1', score: 73.8, trend: 'flat', region: 'europa',
    insight: 'Tercero en el Mundial 2025 y compañero de Norris durante la lucha titular. Top 3 estable de la nueva era F1.',
    emoji: '🇦🇺', country: '🇦🇺',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/330px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg',
    scorePrev: 65.0, trendReason: 'Tercero del Mundial 2025 — pieza clave de McLaren, ahora segundo en 2026 detrás de Antonelli',
    factors: { rendimiento: 80, contexto: 78, mediatico: 70, narrativa: 70 },
  },
  {
    id: 'leclerc', rank: 39, name: 'Charles Leclerc', subtitle: 'Ferrari · Piloto F1',
    sport: 'formula1', score: 73.2, trend: 'down', region: 'europa',
    insight: 'Aguantó el peso de Ferrari mientras Hamilton vivía un año pesadilla. Tercero en Australia inicia una temporada 2026 más optimista.',
    emoji: '🇲🇨', country: '🇲🇨',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3978_by_Stepro_%28cropped2%29.jpg/330px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3978_by_Stepro_%28cropped2%29.jpg',
    scorePrev: 70.0, trendReason: 'Líder de Ferrari, podio en Australia 2026 — la Scuderia mejora con el cambio reglamentario',
    factors: { rendimiento: 78, contexto: 76, mediatico: 76, narrativa: 70 },
  },
  {
    id: 'punk', rank: 40, name: 'CM Punk', subtitle: 'WWE · The Best in the World',
    sport: 'wwe', score: 72.6, trend: 'down', region: 'concacaf',
    insight: 'Perdió el World Heavyweight ante Reigns en WrestleMania 42. Sigue siendo la referencia cultural del wrestling contemporáneo.',
    emoji: '🐍', country: '🇺🇸', position: 'masculino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/CM_Punk_WWE_2024_%28close_crop%29.png/330px-CM_Punk_WWE_2024_%28close_crop%29.png',
    scorePrev: 82.0, trendReason: 'Pierde el World Heavyweight Title ante Reigns en main event de WrestleMania 42',
    factors: { rendimiento: 75, contexto: 74, mediatico: 80, narrativa: 80 },
  },
  {
    id: 'makhachev', rank: 41, name: 'Islam Makhachev', subtitle: 'UFC · Campeón Welter',
    sport: 'ufc', score: 72.0, trend: 'up2', region: 'europa',
    insight: 'Subió a welter y conquistó el cinturón ante Della Maddalena en UFC 322. Doble campeón en distintas divisiones.',
    emoji: '🇷🇺', country: '🇷🇺',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Islam_Makhachev_2022_UFC_belt_%28cropped%29.png/330px-Islam_Makhachev_2022_UFC_belt_%28cropped%29.png',
    scorePrev: 74.1, trendReason: 'Subió a welter y conquistó cinturón vs Della Maddalena en UFC 322 — doble campeón',
    factors: { rendimiento: 84, contexto: 78, mediatico: 68, narrativa: 76 },
  },
  {
    id: 'chimaev', rank: 42, name: 'Khamzat Chimaev', subtitle: 'UFC · Campeón Mediano',
    sport: 'ufc', score: 71.4, trend: 'up2', region: 'europa', badge: 'Nuevo',
    insight: 'Campeón mediano tras vencer a Du Plessis en UFC 319. El proyecto que la UFC empuja como gran cara global.',
    emoji: '🇸🇪', country: '🇸🇪',
    image: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Khamzat_Chimaev_2022_%28cropped%29.png',
    scorePrev: 55.0, trendReason: 'Campeón mediano vs Du Plessis en UFC 319 — la UFC lo posiciona como gran estrella mediática',
    factors: { rendimiento: 82, contexto: 76, mediatico: 70, narrativa: 76 },
  },
  {
    id: 'doncic', rank: 43, name: 'Luka Dončić', subtitle: 'LA Lakers · Base',
    sport: 'baloncesto', score: 70.8, trend: 'up', region: 'europa',
    insight: 'En semis de la NBA con los Lakers junto a LeBron y Reaves. Adaptación rápida tras el bombazo del traspaso de Dallas.',
    emoji: '🇸🇮', country: '🇸🇮', league: 'nba', position: 'base',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Luka_Doncic_%2851914951721%29_%28cropped1%29.jpg/330px-Luka_Doncic_%2851914951721%29_%28cropped1%29.jpg',
    scorePrev: 60.0, trendReason: 'Semifinal de Conferencia con Lakers — adaptación lograda al trío con LeBron y Reaves',
    factors: { rendimiento: 78, contexto: 76, mediatico: 74, narrativa: 72 },
  },
  {
    id: 'vinicius', rank: 44, name: 'Vinicius Jr', subtitle: 'Real Madrid · Extremo',
    sport: 'futbol', score: 69.5, trend: 'down2', region: 'latam',
    insight: 'Año irregular, contrato estancado y oferta histórica del Al-Ahli (€1.000M en salario). Su futuro en Madrid pende de un hilo.',
    emoji: '🇧🇷', country: '🇧🇷', league: 'laliga', position: 'extremo',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg/330px-2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg',
    scorePrev: 93.1, trendReason: 'Negociación contractual rota + oferta histórica de Arabia Saudí — Florentino abre la puerta a la salida',
    factors: { rendimiento: 70, contexto: 76, mediatico: 86, narrativa: 60 },
    editorialBoost: -1.5, editorialNote: 'Conflicto contractual y rumores Saudi descolocan al brasileño en mayo 2026',
  },
  {
    id: 'lebron', rank: 45, name: 'LeBron James', subtitle: 'LA Lakers · Alero',
    sport: 'baloncesto', score: 69.2, trend: 'flat', region: 'concacaf', badge: 'Histórico',
    insight: 'A los 41 años en semifinales con los Lakers junto a Doncic. Posible última temporada antes del retiro definitivo.',
    emoji: '🇺🇸', country: '🇺🇸', league: 'nba', position: 'alero',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/LeBron_James_%2851959977144%29_%28cropped2%29.jpg/330px-LeBron_James_%2851959977144%29_%28cropped2%29.jpg',
    scorePrev: 76.3, trendReason: '41 años, semifinal con Lakers junto a Dončić — posible último baile antes del retiro',
    factors: { rendimiento: 70, contexto: 70, mediatico: 86, narrativa: 76 },
    editorialBoost: 0.5, editorialNote: 'Posible despedida definitiva — protección de legado en su año 23',
  },
  {
    id: 'giannis', rank: 46, name: 'Giannis Antetokounmpo', subtitle: 'Milwaukee Bucks · Ala-Pívot',
    sport: 'baloncesto', score: 68.7, trend: 'down2', region: 'europa',
    insight: 'Tercero en la votación del MVP pero los Bucks fuera de playoffs. Rumores de petición de traspaso al cierre de temporada.',
    emoji: '🇬🇷', country: '🇬🇷', league: 'nba', position: 'ala-pivote',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Giannis_Antetokounmpo_%2851915153421%29_%28cropped%29.jpg/330px-Giannis_Antetokounmpo_%2851915153421%29_%28cropped%29.jpg',
    scorePrev: 82.9, trendReason: 'Tercero en MVP pero Bucks fuera de playoffs — rumores de petición de traspaso a fin de curso',
    factors: { rendimiento: 80, contexto: 64, mediatico: 76, narrativa: 70 },
  },
  {
    id: 'messi', rank: 47, name: 'Lionel Messi', subtitle: 'Inter Miami · Extremo',
    sport: 'futbol', score: 68.0, trend: 'down', region: 'latam', badge: 'Histórico',
    insight: 'El GOAT en su recta final con la mira puesta en el Mundial 2026. Imparable en la MLS pero alejado de la élite europea.',
    emoji: '🇦🇷', country: '🇦🇷', league: 'mls', position: 'extremo',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg/330px-Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg',
    scorePrev: 77.5, trendReason: 'MLS sigue siendo escenario menor — foco total en el Mundial 2026 con Argentina',
    factors: { rendimiento: 64, contexto: 60, mediatico: 88, narrativa: 88 },
    editorialBoost: 1.0, editorialNote: 'GOAT en recta final — protección histórica con Mundial 2026 en mente',
  },
  {
    id: 'foden', rank: 48, name: 'Phil Foden', subtitle: 'Manchester City · Mediapunta',
    sport: 'futbol', score: 67.4, trend: 'down', region: 'europa',
    insight: 'Temporada perdida en un City desnortado sin Premier ni Champions. Pierde protagonismo en la elite europea.',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', league: 'premier', position: 'mediapunta',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/2023-10-04_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League%2C_RB_Leipzig_-_Manchester_City_FC_1DX_2613%2C_Phil_Foden.jpg/330px-2023-10-04_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League%2C_RB_Leipzig_-_Manchester_City_FC_1DX_2613%2C_Phil_Foden.jpg',
    scorePrev: 75.2, trendReason: 'City sin títulos y proyecto en transición — Foden pierde protagonismo y bajón colectivo',
    factors: { rendimiento: 70, contexto: 70, mediatico: 64, narrativa: 64 },
  },
  {
    id: 'mcgregor', rank: 49, name: 'Conor McGregor', subtitle: 'UFC · Peso Ligero',
    sport: 'ufc', score: 56.2, trend: 'down2', region: 'europa', badge: 'Histórico',
    insight: 'Inactivo casi cinco años. La marca personal sigue siendo enorme pero la relevancia deportiva está en mínimos absolutos.',
    emoji: '🇮🇪', country: '🇮🇪',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Conor_McGregor_2025.jpeg/330px-Conor_McGregor_2025.jpeg',
    scorePrev: 56.7, trendReason: 'Cinco años sin pelear — marca personal intacta pero irrelevancia deportiva total',
    factors: { rendimiento: 36, contexto: 46, mediatico: 80, narrativa: 72 },
  },
  {
    id: 'jhon-duran', rank: 50, name: 'Jhon Durán', subtitle: 'Al-Nassr · Delantero',
    sport: 'futbol', score: 55.0, trend: 'flat', region: 'latam',
    insight: 'Salto a Arabia Saudí tras explosión en Aston Villa. Goleador a buen ritmo pero alejado del foco de la élite competitiva.',
    emoji: '🇨🇴', country: '🇨🇴', league: 'mls', position: 'delantero',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Jhon_Dur%C3%A1n%2C_Esteghlal_FC_vs_Al-Nassr_FC_%28ACLElite%29%3B_3_Mar_2025.png/330px-Jhon_Dur%C3%A1n%2C_Esteghlal_FC_vs_Al-Nassr_FC_%28ACLElite%29%3B_3_Mar_2025.png',
    scorePrev: 46.1, trendReason: 'Salto Aston Villa → Al-Nassr en verano 2025 — goles regulares en Saudi Pro League',
    factors: { rendimiento: 72, contexto: 50, mediatico: 50, narrativa: 60 },
  },
  // ── WWE entries ──────────────────────────────────────────────────
  {
    id: 'iyo-sky', rank: 51, name: 'Iyo Sky', subtitle: 'WWE · Genius of the Sky',
    sport: 'wwe', score: 79.4, trend: 'up', region: 'concacaf', badge: 'Revelación',
    insight: 'La luchadora más técnica del roster. Su estilo aéreo es único en el panorama femenino WWE actual.',
    emoji: '🌸', country: '🇯🇵', position: 'femenino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Iyo_Sky_042025_%28Cropped%29.jpg/330px-Iyo_Sky_042025_%28Cropped%29.jpg',
    scorePrev: 76.1, trendReason: 'Sigue ascendiendo como referente técnico del wrestling femenino — punto fuerte del roster',
    factors: { rendimiento: 84, contexto: 78, mediatico: 72, narrativa: 80 },
  },
  {
    id: 'liv-morgan', rank: 52, name: 'Liv Morgan', subtitle: 'WWE · Capo',
    sport: 'wwe', score: 77.8, trend: 'up', region: 'concacaf',
    insight: 'La consolidación más sorprendente del wrestling femenino moderno. De undercard a figura principal en tiempo récord.',
    emoji: '🔴', country: '🇺🇸', position: 'femenino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Big_E%2C_Liv_Morgan_%26_Tyler_Breeze_%281%29_%28cropped_2%29.jpg/330px-Big_E%2C_Liv_Morgan_%26_Tyler_Breeze_%281%29_%28cropped_2%29.jpg',
    scorePrev: 74.8, trendReason: 'Consolidación como figura principal del roster femenino tras año estelar',
    factors: { rendimiento: 80, contexto: 76, mediatico: 74, narrativa: 82 },
  },
  {
    id: 'becky', rank: 53, name: 'Becky Lynch', subtitle: 'WWE · The Man',
    sport: 'wwe', score: 76.4, trend: 'flat', region: 'europa', badge: 'Histórico',
    insight: 'La luchadora que cambió la Women\'s Revolution. Icono global del wrestling femenino con vigencia actual probada.',
    emoji: '👊', country: '🇮🇪', position: 'femenino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Becky_Lynch_Galaxycon.jpg/330px-Becky_Lynch_Galaxycon.jpg',
    scorePrev: 86.0, trendReason: 'Años desde su pico mediático pero estilo y carisma intactos — referencia del roster',
    factors: { rendimiento: 78, contexto: 76, mediatico: 76, narrativa: 80 },
  },
  {
    id: 'belair', rank: 54, name: 'Bianca Belair', subtitle: 'WWE · The EST of WWE',
    sport: 'wwe', score: 75.8, trend: 'flat', region: 'concacaf',
    insight: 'Atletismo extremo y personalidad desbordante. Una de las caras del wrestling femenino estadounidense.',
    emoji: '✨', country: '🇺🇸', position: 'femenino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Bianca_Belair_042025_%28cropped%29.jpg/330px-Bianca_Belair_042025_%28cropped%29.jpg',
    scorePrev: 83.2, trendReason: 'Sigue siendo top tier femenino — pero menos protagonismo en main event que años anteriores',
    factors: { rendimiento: 80, contexto: 76, mediatico: 74, narrativa: 78 },
  },
  {
    id: 'rollins', rank: 55, name: 'Seth Rollins', subtitle: 'WWE · The Visionary',
    sport: 'wwe', score: 74.2, trend: 'down', region: 'concacaf',
    insight: 'El trabajador más versátil de la empresa. Puede hacer cualquier tipo de lucha y brillar en main event o midcard.',
    emoji: '🔴', country: '🇺🇸', position: 'masculino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Seth_Rollins_July_2019.jpg/330px-Seth_Rollins_July_2019.jpg',
    scorePrev: 84.0, trendReason: 'Lesiones y rotación fuera del main event — sigue siendo de los mejores trabajadores',
    factors: { rendimiento: 78, contexto: 74, mediatico: 72, narrativa: 78 },
  },
  {
    id: 'jey-uso', rank: 56, name: 'Jey Uso', subtitle: 'WWE · YEET',
    sport: 'wwe', score: 73.0, trend: 'up', region: 'concacaf',
    insight: 'El favorito del público en cada show. Su carisma viral define el ambiente de las arenas WWE en cada aparición.',
    emoji: '🤙', country: '🇺🇸', position: 'masculino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Jey_Uso_RR25_%281%29_%28cropped%29.jpg/330px-Jey_Uso_RR25_%281%29_%28cropped%29.jpg',
    scorePrev: 70.0, trendReason: 'Carisma viral consolidado: el "YEET" es el momento favorito del público en cada show',
    factors: { rendimiento: 76, contexto: 72, mediatico: 78, narrativa: 78 },
  },
  {
    id: 'femi', rank: 57, name: 'Oba Femi', subtitle: 'WWE · NXT to Main Roster',
    sport: 'wwe', score: 71.5, trend: 'up2', region: 'europa', badge: 'Revelación',
    insight: 'Venció a Brock Lesnar en WrestleMania 42 N1. La revelación más grande del nuevo roster post-NXT.',
    emoji: '🇳🇬', country: '🇳🇬', position: 'masculino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Oba_Femi_2024.jpg/330px-Oba_Femi_2024.jpg',
    scorePrev: 60.0, trendReason: 'Vence a Brock Lesnar en WrestleMania 42 — explosión definitiva al main roster',
    factors: { rendimiento: 76, contexto: 70, mediatico: 70, narrativa: 80 },
  },
  {
    id: 'sami-zayn', rank: 58, name: 'Sami Zayn', subtitle: 'WWE · Honorary Uce',
    sport: 'wwe', score: 70.4, trend: 'down', region: 'concacaf',
    insight: 'Perdió el US Title ante Trick Williams en WrestleMania 42. El favorito más genuino del público sigue siendo referencia.',
    emoji: '🎤', country: '🇨🇦', position: 'masculino',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Sami_Zayn_041826_%28cropped%29.jpg/330px-Sami_Zayn_041826_%28cropped%29.jpg',
    scorePrev: 78.8, trendReason: 'Pierde el US Championship ante Trick Williams en WrestleMania 42',
    factors: { rendimiento: 74, contexto: 72, mediatico: 70, narrativa: 80 },
  },
]

// ── JUGADORAS — FÚTBOL FEMENINO ───────────────────────────────────
export const RANKING_JUGADORAS: RankingEntry[] = [
  {
    id: 'bonmati', rank: 1, name: 'Aitana Bonmatí', subtitle: 'FC Barcelona · Mediapunta',
    sport: 'futbol', score: 96.8, trend: 'up', gender: 'f', region: 'europa', badge: 'Histórico',
    insight: 'Tercer Balón de Oro Femenino consecutivo (2023, 2024, 2025). Player of the Tournament en la Eurocopa 2025. Único en la historia.',
    emoji: '🇪🇸', country: '🇪🇸', league: 'ligaf', position: 'mediapunta',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/25th_Laureus_World_Sports_Awards_-_240422_214032.jpg/330px-25th_Laureus_World_Sports_Awards_-_240422_214032.jpg',
    scorePrev: 95.7, trendReason: 'Tercer Balón de Oro Femenino consecutivo — Player of the Tournament en la Euro 2025',
    factors: { rendimiento: 99, contexto: 98, mediatico: 92, narrativa: 97 },
  },
  {
    id: 'caldentey', rank: 2, name: 'Mariona Caldentey', subtitle: 'Arsenal Women · Extremo',
    sport: 'futbol', score: 91.5, trend: 'up2', gender: 'f', region: 'europa',
    insight: 'Subcampeona del Balón de Oro 2025. Marcó el gol de España en la final de la Eurocopa y campeona de la Champions con el Arsenal.',
    emoji: '🇪🇸', country: '🇪🇸', league: 'championsf', position: 'extremo',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A5801_%28cropped%29.jpg/330px-Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A5801_%28cropped%29.jpg',
    scorePrev: 77.3, trendReason: 'Subcampeona Balón de Oro + Champions con Arsenal + gol final Eurocopa España',
    factors: { rendimiento: 94, contexto: 93, mediatico: 84, narrativa: 92 },
  },
  {
    id: 'russo', rank: 3, name: 'Alessia Russo', subtitle: 'Arsenal Women · Delantera',
    sport: 'futbol', score: 89.2, trend: 'up2', gender: 'f', region: 'europa',
    insight: 'Tercera del Balón de Oro 2025. Goleadora en la final de la Eurocopa y referencia del Arsenal campeón de Champions.',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', league: 'championsf', position: 'delantero',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Valerenga-Arsenal_WUCL_12-12-2024_CG3A4421_05_%28cropped-J1%29.jpg/330px-Valerenga-Arsenal_WUCL_12-12-2024_CG3A4421_05_%28cropped-J1%29.jpg',
    scorePrev: 70.0, trendReason: 'Tercera Balón de Oro + Champions Arsenal + gol final Eurocopa Inglaterra',
    factors: { rendimiento: 92, contexto: 90, mediatico: 84, narrativa: 88 },
  },
  {
    id: 'pajor', rank: 4, name: 'Ewa Pajor', subtitle: 'FC Barcelona · Delantera',
    sport: 'futbol', score: 88.1, trend: 'up2', gender: 'f', region: 'europa', badge: 'Nuevo',
    insight: 'Pichichi de Liga F en su debut con el Barça (25 goles). La delantera centro perfecta para el proyecto azulgrana.',
    emoji: '🇵🇱', country: '🇵🇱', league: 'ligaf', position: 'delantero',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/2018_Women%27s_DFB-Pokal_Final_-_Ewa_Pajor_%28Wolfsburg%29_%28cropped%29.jpg/330px-2018_Women%27s_DFB-Pokal_Final_-_Ewa_Pajor_%28Wolfsburg%29_%28cropped%29.jpg',
    scorePrev: 70.0, trendReason: 'Pichichi de Liga F en su debut con el Barça (25 goles en 28 partidos)',
    factors: { rendimiento: 92, contexto: 89, mediatico: 80, narrativa: 86 },
  },
  {
    id: 'putellas', rank: 5, name: 'Alexia Putellas', subtitle: 'FC Barcelona · Mediapunta',
    sport: 'futbol', score: 87.6, trend: 'down', gender: 'f', region: 'europa', badge: 'Histórico',
    insight: 'Año récord (27 goles + 21 asistencias) pero el Barça perdió la Champions ante el Arsenal. Top 5 del Balón de Oro 2025.',
    emoji: '🇪🇸', country: '🇪🇸', league: 'ligaf', position: 'mediapunta',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A5851_%28cropped%29.jpg/330px-Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A5851_%28cropped%29.jpg',
    scorePrev: 91.1, trendReason: 'Año récord en stats pero Barça pierde la Champions ante Arsenal — top 5 BdO',
    factors: { rendimiento: 92, contexto: 88, mediatico: 80, narrativa: 86 },
  },
  {
    id: 'paralluelo', rank: 6, name: 'Salma Paralluelo', subtitle: 'FC Barcelona · Delantera',
    sport: 'futbol', score: 84.0, trend: 'down', gender: 'f', region: 'europa',
    insight: 'Finalista de la Eurocopa con España. La explosividad y el gol de la nueva generación se mantiene en lo más alto.',
    emoji: '🇪🇸', country: '🇪🇸', league: 'ligaf', position: 'delantero',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A6178_%28cropped%29.jpg/330px-Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A6178_%28cropped%29.jpg',
    scorePrev: 87.9, trendReason: 'Finalista Eurocopa con España — Barça sin Champions le baja un peldaño',
    factors: { rendimiento: 87, contexto: 84, mediatico: 80, narrativa: 84 },
  },
  {
    id: 'hampton', rank: 7, name: 'Hannah Hampton', subtitle: 'Chelsea Women · Portera',
    sport: 'futbol', score: 82.6, trend: 'up2', gender: 'f', region: 'europa', badge: 'Revelación',
    insight: 'Player of the Match de la final de la Eurocopa: paró dos penaltis ante España. La nueva referencia bajo palos del fútbol femenino.',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', league: 'championsf', position: 'portera',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/20250510-Hannah_Hampton_%28cropped_-_portrait%29.jpg/330px-20250510-Hannah_Hampton_%28cropped_-_portrait%29.jpg',
    scorePrev: 65.0, trendReason: 'Player of the Match en la final Eurocopa — paró dos penaltis a España',
    factors: { rendimiento: 88, contexto: 84, mediatico: 76, narrativa: 84 },
  },
  {
    id: 'hansen', rank: 8, name: 'Caroline Graham Hansen', subtitle: 'FC Barcelona · Extremo',
    sport: 'futbol', score: 80.7, trend: 'down', gender: 'f', region: 'europa',
    insight: 'Sigue siendo la extremo más desequilibrante de la Champions femenina. Perfil de élite pese al curso colectivo discreto.',
    emoji: '🇳🇴', country: '🇳🇴', league: 'ligaf', position: 'extremo',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A7081_%28cropped%29.jpg/330px-Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A7081_%28cropped%29.jpg',
    scorePrev: 84.0, trendReason: 'Sigue siendo top tier pero Barça sin Champions le baja un peldaño',
    factors: { rendimiento: 84, contexto: 82, mediatico: 74, narrativa: 80 },
  },
  {
    id: 'kelly', rank: 9, name: 'Chloe Kelly', subtitle: 'Arsenal Women · Extremo',
    sport: 'futbol', score: 79.0, trend: 'up2', gender: 'f', region: 'europa',
    insight: 'Marcó el penalti decisivo en la final de la Eurocopa, repitiendo heroína nacional. Suplente de oro de Inglaterra.',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', league: 'championsf', position: 'extremo',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/On_29.07.England_Lionesses_Bus_Celebration_-_The_Mall%2C_Lond2025_11_%28cropped-J1%29.jpg/330px-On_29.07.England_Lionesses_Bus_Celebration_-_The_Mall%2C_Lond2025_11_%28cropped-J1%29.jpg',
    scorePrev: 65.0, trendReason: 'Penal decisivo en la final Eurocopa 2025 — heroína nacional por segunda vez',
    factors: { rendimiento: 80, contexto: 80, mediatico: 76, narrativa: 84 },
  },
  {
    id: 'kerr', rank: 10, name: 'Sam Kerr', subtitle: 'Chelsea Women · Delantera',
    sport: 'futbol', score: 76.5, trend: 'down', gender: 'f', region: 'europa',
    insight: 'Vuelta tras lesión grave. La goleadora de referencia de la WSL recupera su nivel pero con menor protagonismo en la temporada.',
    emoji: '🇦🇺', country: '🇦🇺', league: 'championsf', position: 'delantero',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Sam_Kerr_%28Women_World_Cup_France_2019%29.jpg/330px-Sam_Kerr_%28Women_World_Cup_France_2019%29.jpg',
    scorePrev: 80.1, trendReason: 'Recuperación lenta tras lesión grave — protagonismo reducido en la temporada',
    factors: { rendimiento: 78, contexto: 78, mediatico: 72, narrativa: 76 },
  },
]

// ── CLUBES — FÚTBOL FEMENINO ──────────────────────────────────────
export const RANKING_CLUBES_FEMENINO: RankingEntry[] = [
  {
    id: 'arsenal-w', rank: 1, name: 'Arsenal Women', subtitle: 'WSL · Inglaterra',
    sport: 'futbol', score: 95.4, trend: 'up2', gender: 'f', region: 'europa', badge: 'Nuevo',
    league: 'championsf', country: 'england',
    insight: 'Campeón de la Champions Femenina 24/25 ante el Barça (1-0). Primer título europeo en 18 años, primer equipo en hacerlo desde la fase clasificatoria.',
    emoji: '🔴',
    scorePrev: 84.3, trendReason: 'Champions Femenina 24/25 vs Barcelona (1-0 Blackstenius) — primer título europeo en 18 años',
    factors: { rendimiento: 96, contexto: 95, mediatico: 92, narrativa: 96 },
  },
  {
    id: 'barca-f', rank: 2, name: 'FC Barcelona Femenino', subtitle: 'Liga F · España',
    sport: 'futbol', score: 92.0, trend: 'down', gender: 'f', region: 'europa', badge: 'Histórico',
    league: 'ligaf', country: 'spain',
    insight: 'Campeón de Liga F y Copa de la Reina, pero perdió la final de Champions ante el Arsenal. Treble doméstico que sabe a poco en Europa.',
    emoji: '🔴🔵',
    scorePrev: 96.4, trendReason: 'Treble doméstico pero perdió la final de Champions ante Arsenal — pierde corona europea',
    factors: { rendimiento: 94, contexto: 92, mediatico: 92, narrativa: 90 },
  },
  {
    id: 'chelsea-w', rank: 3, name: 'Chelsea Women', subtitle: 'WSL · Inglaterra',
    sport: 'futbol', score: 88.0, trend: 'flat', gender: 'f', region: 'europa',
    league: 'championsf', country: 'england',
    insight: 'Inversión sostenida y proyecto a largo plazo. Sigue siendo gran potencia inglesa pese al ascenso del Arsenal.',
    emoji: '🔵',
    scorePrev: 88.7, trendReason: 'Sigue siendo potencia consolidada de la WSL — eclipsado por el Arsenal este curso',
    factors: { rendimiento: 88, contexto: 88, mediatico: 88, narrativa: 86 },
  },
  {
    id: 'lyon-f', rank: 4, name: 'Olympique Lyon', subtitle: 'Première Ligue · Francia',
    sport: 'futbol', score: 87.4, trend: 'down', gender: 'f', region: 'europa', badge: 'Histórico',
    league: 'championsf', country: 'france',
    insight: 'Ocho Champions femeninas en su historia. La era dorada se desinfla pero el legado sigue siendo el más grande del fútbol europeo.',
    emoji: '🔴',
    scorePrev: 93.1, trendReason: 'Lejos de las finales europeas — el legado sostiene la posición pese al declive deportivo',
    factors: { rendimiento: 84, contexto: 86, mediatico: 88, narrativa: 92 },
  },
  {
    id: 'realmadrid-f', rank: 5, name: 'Real Madrid Femenino', subtitle: 'Liga F · España',
    sport: 'futbol', score: 84.6, trend: 'up2', gender: 'f', region: 'europa', badge: 'Revelación',
    league: 'ligaf', country: 'spain',
    insight: 'Top 4 de Liga F y crecimiento ininterrumpido del proyecto. La rivalidad con Barça se acerca al equilibrio competitivo.',
    emoji: '⚪',
    scorePrev: 81.8, trendReason: 'Crecimiento sostenido del proyecto madridista — la rivalidad con Barça se acerca al equilibrio',
    factors: { rendimiento: 86, contexto: 84, mediatico: 82, narrativa: 86 },
  },
  {
    id: 'wolfsburg-f', rank: 6, name: 'VfL Wolfsburg', subtitle: 'Frauen-Bundesliga · Alemania',
    sport: 'futbol', score: 83.2, trend: 'down', gender: 'f', region: 'europa',
    league: 'championsf', country: 'germany',
    insight: 'Dos Champions en su historia y cantera de élite alemana. Año irregular pero la estructura sigue siendo de élite.',
    emoji: '🟢⚪',
    scorePrev: 86.5, trendReason: 'Año más irregular sin presencia europea decisiva — pero estructura de élite intacta',
    factors: { rendimiento: 82, contexto: 84, mediatico: 80, narrativa: 86 },
  },
]

// ── JUGADORES — SUB-25 ────────────────────────────────────────────
export const RANKING_JUGADORES_SUB21: RankingEntry[] = [
  {
    id: 'yamal-sub21', rank: 1, name: 'Lamine Yamal', subtitle: 'FC Barcelona · 18 años',
    sport: 'futbol', score: 94.6, trend: 'up', region: 'sub21', badge: 'Revelación',
    insight: 'Subcampeón del Balón de Oro absoluto con 18 años. Sin precedentes históricos en el fútbol moderno.',
    emoji: '🇪🇸', country: '🇪🇸',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Lamine_Yamal_in_2025.jpg/330px-Lamine_Yamal_in_2025.jpg',
    scorePrev: 92.5, trendReason: 'Segundo en el Balón de Oro 2025 — fenómeno generacional confirmado',
    factors: { rendimiento: 95, contexto: 93, mediatico: 96, narrativa: 97 },
  },
  {
    id: 'doue-sub21', rank: 2, name: 'Désiré Doué', subtitle: 'Paris Saint-Germain · 19 años',
    sport: 'futbol', score: 89.6, trend: 'up2', region: 'sub21', badge: 'Revelación',
    insight: 'MVP de la final de Champions con 19 años. La pieza clave del PSG del cuádruplete que ya forma parte del top mundial absoluto.',
    emoji: '🇫🇷', country: '🇫🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Doue_asse_psg_2425.png/330px-Doue_asse_psg_2425.png',
    scorePrev: 70.0, trendReason: 'Player of the Match en la final de Champions 5-0 al Inter con 19 años',
    factors: { rendimiento: 90, contexto: 92, mediatico: 84, narrativa: 92 },
  },
  {
    id: 'wemba-sub21', rank: 3, name: 'Victor Wembanyama', subtitle: 'San Antonio Spurs · 22 años',
    sport: 'baloncesto', score: 87.2, trend: 'up', region: 'sub21', badge: 'Revelación',
    insight: 'Récord de 12 tapones en un partido de playoffs. La promesa NBA más singular ya juega en finales de conferencia.',
    emoji: '🇫🇷', country: '🇫🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Victor_Wembanyama_San_Antonio_Spurs_2024.jpg/330px-Victor_Wembanyama_San_Antonio_Spurs_2024.jpg',
    scorePrev: 85.9, trendReason: 'Récord 12 tapones en playoffs — los Spurs entre los favoritos del Oeste',
    factors: { rendimiento: 91, contexto: 84, mediatico: 84, narrativa: 92 },
  },
  {
    id: 'antonelli-sub21', rank: 4, name: 'Kimi Antonelli', subtitle: 'Mercedes · 19 años',
    sport: 'formula1', score: 86.5, trend: 'up2', region: 'sub21', badge: 'Revelación',
    insight: 'Líder del Mundial de F1 2026 con 19 años. La nueva era del reglamento técnico tiene cara italiana y rookie.',
    emoji: '🇮🇹', country: '🇮🇹',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Kimi_Antonelli_at_the_2025_US_Grand_Prix_in_Austin%2C_TX_%28cropped%29.jpg/330px-Kimi_Antonelli_at_the_2025_US_Grand_Prix_in_Austin%2C_TX_%28cropped%29.jpg',
    scorePrev: 60.0, trendReason: 'Líder del Mundial 2026 con dos victorias en cuatro carreras a los 19 años',
    factors: { rendimiento: 91, contexto: 84, mediatico: 80, narrativa: 92 },
  },
  {
    id: 'alcaraz-sub21', rank: 5, name: 'Carlos Alcaraz', subtitle: 'ATP Tenis · 22 años',
    sport: 'tenis', score: 85.9, trend: 'up2', region: 'sub21',
    insight: 'Career Grand Slam con 22 años: el más joven de la historia. Ganador del AO 2026 ante Djokovic y de Roland Garros 2025.',
    emoji: '🇪🇸', country: '🇪🇸',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Carlos_Alcaraz_2025_FO.jpg/330px-Carlos_Alcaraz_2025_FO.jpg',
    scorePrev: 82.9, trendReason: 'Career Slam más joven de la historia tras ganar el Australian Open 2026 a Djokovic',
    factors: { rendimiento: 92, contexto: 86, mediatico: 84, narrativa: 92 },
  },
  {
    id: 'bellingham-sub21', rank: 6, name: 'Jude Bellingham', subtitle: 'Real Madrid · 22 años',
    sport: 'futbol', score: 81.0, trend: 'down', region: 'sub21',
    insight: 'Líder del Madrid de Arbeloa pese a la inestabilidad institucional. Madurez prematura e impacto global con 22 años.',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Jude_Bellingham_-_240422_190551-2_%28cropped%29.jpg/330px-25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Jude_Bellingham_-_240422_190551-2_%28cropped%29.jpg',
    scorePrev: 84.4, trendReason: 'Madrid en crisis institucional — Bellingham sostiene el bloque pese al caos del banquillo',
    factors: { rendimiento: 82, contexto: 80, mediatico: 82, narrativa: 78 },
  },
  {
    id: 'wirtz-sub21', rank: 7, name: 'Florian Wirtz', subtitle: 'Liverpool · 22 años',
    sport: 'futbol', score: 80.4, trend: 'up2', region: 'sub21',
    insight: 'Récord británico de transferencia (£116M) al Liverpool campeón de Premier. La estrella del nuevo proyecto Slot.',
    emoji: '🇩🇪', country: '🇩🇪',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Florian_Wirtz%2C_2022-07-31%2C_Saisoner%C3%B6ffnung_Bayer_04%2C_Leverkusen_%281%29_%28cropped%29.jpg/330px-Florian_Wirtz%2C_2022-07-31%2C_Saisoner%C3%B6ffnung_Bayer_04%2C_Leverkusen_%281%29_%28cropped%29.jpg',
    scorePrev: 70.0, trendReason: 'Fichaje récord £116M Liverpool campeón Premier — nueva pieza estrella del proyecto Slot',
    factors: { rendimiento: 84, contexto: 84, mediatico: 76, narrativa: 80 },
  },
]

// ── JUGADORES — EUROPA ────────────────────────────────────────────
export const RANKING_JUGADORES_EUROPA: RankingEntry[] = RANKING_JUGADORES.filter(j => j.region === 'europa' || j.sport === 'futbol').slice(0, 7)

// ── JUGADORES — LATAM ─────────────────────────────────────────────
export const RANKING_JUGADORES_LATAM: RankingEntry[] = [
  {
    id: 'lautaro-latam', rank: 1, name: 'Lautaro Martínez', subtitle: 'Inter de Milán · Argentina',
    sport: 'futbol', score: 76.4, trend: 'down', region: 'latam',
    insight: 'Capitán y goleador del Inter pese a la final perdida 0-5 en Champions. Líder argentino tras Messi.',
    emoji: '🇦🇷', country: '🇦🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Lautaro_Martinez_ARGENTINA_VS_VENEZUELA_2017.jpg/330px-Lautaro_Martinez_ARGENTINA_VS_VENEZUELA_2017.jpg',
    scorePrev: 69.8, trendReason: 'Final de Champions 0-5 perdida pero sigue como capitán y referente argentino post-Messi',
    factors: { rendimiento: 80, contexto: 76, mediatico: 70, narrativa: 76 },
  },
  {
    id: 'pereira-latam', rank: 2, name: 'Alex Pereira', subtitle: 'UFC · Brasil',
    sport: 'ufc', score: 83.7, trend: 'up', region: 'latam',
    insight: 'Doble campeón UFC: recuperó el cinturón semipesado en UFC 320. Ya planea salto al peso pesado tras la era Aspinall.',
    emoji: '🇧🇷', country: '🇧🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Alex_Pereira_UFC_300.png/330px-Alex_Pereira_UFC_300.png',
    scorePrev: 75.0, trendReason: 'Recupera cinturón semipesado vs Ankalaev en UFC 320 — sondeo del salto a heavyweight',
    factors: { rendimiento: 87, contexto: 83, mediatico: 87, narrativa: 84 },
  },
  {
    id: 'vinicius-latam', rank: 3, name: 'Vinicius Jr', subtitle: 'Real Madrid · Brasil',
    sport: 'futbol', score: 69.5, trend: 'down2', region: 'latam',
    insight: 'Año irregular en Madrid y oferta histórica del Al-Ahli. Su futuro pende del desenlace contractual del verano.',
    emoji: '🇧🇷', country: '🇧🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg/330px-2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg',
    scorePrev: 93.0, trendReason: 'Bajón rendimiento + oferta histórica de Arabia — Florentino abre la puerta a la salida',
    factors: { rendimiento: 70, contexto: 76, mediatico: 86, narrativa: 60 },
  },
  {
    id: 'messi-latam', rank: 4, name: 'Lionel Messi', subtitle: 'Inter Miami · Argentina',
    sport: 'futbol', score: 68.0, trend: 'down', region: 'latam', badge: 'Histórico',
    insight: 'Foco total en el Mundial 2026 con la Albiceleste. La leyenda viva en sus últimos meses competitivos al máximo nivel.',
    emoji: '🇦🇷', country: '🇦🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg/330px-Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg',
    scorePrev: 77.5, trendReason: 'MLS escenario menor — todo el foco en el Mundial 2026 con Argentina',
    factors: { rendimiento: 64, contexto: 60, mediatico: 88, narrativa: 88 },
  },
  {
    id: 'enzo', rank: 5, name: 'Enzo Fernández', subtitle: 'Chelsea · Argentina',
    sport: 'futbol', score: 76.8, trend: 'up', region: 'latam',
    insight: 'Campeón del Mundial de Clubes 2025 con el Chelsea (3-0 al PSG). El sucesor de Mascherano consolidado en la Premier.',
    emoji: '🇦🇷', country: '🇦🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Enzo_Fern%C3%A1ndez_2025_FIFA_Club_World_Cup_Final.jpg/330px-Enzo_Fern%C3%A1ndez_2025_FIFA_Club_World_Cup_Final.jpg',
    scorePrev: 78.9, trendReason: 'Mundial de Clubes 2025 con Chelsea — referente del centrocampo argentino actual',
    factors: { rendimiento: 80, contexto: 80, mediatico: 72, narrativa: 76 },
  },
  {
    id: 'palmer', rank: 6, name: 'Cole Palmer', subtitle: 'Chelsea · Inglaterra (sin LATAM, ref. Mundial Clubes)',
    sport: 'futbol', score: 78.6, trend: 'up2', region: 'europa',
    insight: 'Figura del Chelsea campeón del Mundial de Clubes 2025: dos goles y asistencia en la final ante el PSG.',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    image: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Cole_Palmer_2025_FIFA_Club_World_Cup_Final.jpg',
    scorePrev: 65.0, trendReason: 'Figura final Mundial Clubes 2025 — 2 goles + asistencia ante el PSG',
    factors: { rendimiento: 82, contexto: 84, mediatico: 76, narrativa: 80 },
  },
  {
    id: 'rodrygo-latam', rank: 7, name: 'Rodrygo Goes', subtitle: 'Real Madrid · Brasil',
    sport: 'futbol', score: 73.6, trend: 'flat', region: 'latam',
    insight: 'En la diana de los rumores de salida del Madrid. Su perfil versátil sigue siendo apreciado en el mercado europeo.',
    emoji: '🇧🇷', country: '🇧🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Rodrygo_2023_%28cropped%29.jpg/330px-Rodrygo_2023_%28cropped%29.jpg',
    scorePrev: 77.0, trendReason: 'Año irregular y rumores de salida del Madrid — sigue siendo perfil de élite versátil',
    factors: { rendimiento: 76, contexto: 78, mediatico: 70, narrativa: 70 },
  },
  {
    id: 'alisson-latam', rank: 8, name: 'Alisson Becker', subtitle: 'Liverpool · Brasil',
    sport: 'futbol', score: 78.2, trend: 'up', region: 'latam',
    insight: 'Campeón de Premier League con el Liverpool de Slot. Sigue siendo el mejor portero sudamericano del fútbol mundial.',
    emoji: '🇧🇷', country: '🇧🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/20180610_FIFA_Friendly_Match_Austria_vs._Brazil_850_1625.jpg/330px-20180610_FIFA_Friendly_Match_Austria_vs._Brazil_850_1625.jpg',
    scorePrev: 74.9, trendReason: 'Premier League con Liverpool — portero indiscutido del proyecto campeón',
    factors: { rendimiento: 84, contexto: 84, mediatico: 64, narrativa: 72 },
  },
  {
    id: 'endrick-latam', rank: 9, name: 'Endrick', subtitle: 'Real Madrid · Brasil · 19 años',
    sport: 'futbol', score: 72.0, trend: 'flat', region: 'latam', badge: 'Revelación',
    insight: 'Pelea minutos en el Madrid de Arbeloa con goles puntuales. La promesa brasileña sigue creciendo a fuego lento.',
    emoji: '🇧🇷', country: '🇧🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Endrick-Palmeiras-Liverpool-abr24.jpg/330px-Endrick-Palmeiras-Liverpool-abr24.jpg',
    scorePrev: 73.3, trendReason: 'Pelea minutos en Madrid bajo Arbeloa — goles puntuales pero crecimiento gradual',
    factors: { rendimiento: 74, contexto: 76, mediatico: 64, narrativa: 74 },
  },
  {
    id: 'estevao', rank: 10, name: 'Estêvão', subtitle: 'Chelsea · Brasil · 18 años',
    sport: 'futbol', score: 71.0, trend: 'up2', region: 'latam', badge: 'Revelación',
    insight: 'Campeón del Mundial de Clubes 2025 con el Chelsea. La nueva joya brasileña tras debutar en la Premier con 18 años.',
    emoji: '🇧🇷', country: '🇧🇷',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Estevao-Palmeiras-Liverpool-abr24_%28cropped%29.jpg/330px-Estevao-Palmeiras-Liverpool-abr24_%28cropped%29.jpg',
    scorePrev: 55.0, trendReason: 'Campeón Mundial de Clubes 2025 con Chelsea — debut en Premier a los 18 años',
    factors: { rendimiento: 74, contexto: 76, mediatico: 64, narrativa: 76 },
  },
]

// ── JUGADORES — CONCACAF ──────────────────────────────────────────
export const RANKING_JUGADORES_CONCACAF: RankingEntry[] = [
  {
    id: 'sga-cc', rank: 1, name: 'Shai Gilgeous-Alexander', subtitle: 'OKC Thunder · Canadá',
    sport: 'baloncesto', score: 90.3, trend: 'up2', region: 'concacaf',
    insight: 'MVP regular y MVP de las Finales 2025 con anillo del Thunder. El mejor jugador de Concacaf de los últimos 20 años.',
    emoji: '🇨🇦', country: '🇨🇦',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Shai_Gilgeous-Alexander_-_Thunder_vs._Wizards.png/330px-Shai_Gilgeous-Alexander_-_Thunder_vs._Wizards.png',
    scorePrev: 88.3, trendReason: 'Doblete histórico MVP regular + Finales — primer caso desde LeBron 2013',
    factors: { rendimiento: 98, contexto: 92, mediatico: 84, narrativa: 92 },
  },
  {
    id: 'tatum-cc', rank: 2, name: 'Jayson Tatum', subtitle: 'Boston Celtics · EEUU',
    sport: 'baloncesto', score: 79.2, trend: 'down', region: 'concacaf',
    insight: 'Defensor del título 2024 con los Celtics. Avanza en playoffs 2026 pero ya no como líder absoluto del Este.',
    emoji: '🇺🇸', country: '🇺🇸',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Celtics_at_Wizards_2024-12-044_%28cropped_2%29.jpg/330px-Celtics_at_Wizards_2024-12-044_%28cropped_2%29.jpg',
    scorePrev: 64.6, trendReason: 'Defensa del anillo y avance en playoffs 2026 — eclipsado por la era Thunder/SGA',
    factors: { rendimiento: 81, contexto: 80, mediatico: 76, narrativa: 80 },
  },
  {
    id: 'pulisic', rank: 3, name: 'Christian Pulisic', subtitle: 'AC Milan · EEUU',
    sport: 'futbol', score: 73.4, trend: 'up', region: 'concacaf',
    insight: 'Mejor temporada de su carrera en la Serie A. Capitán de la USMNT en su año pre-Mundial 2026 organizado en casa.',
    emoji: '🇺🇸', country: '🇺🇸',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Christian_Pulisic_USMNT_v_Belgium_Mar_28_2026-73_%28cropped%29.jpg/330px-Christian_Pulisic_USMNT_v_Belgium_Mar_28_2026-73_%28cropped%29.jpg',
    scorePrev: 71.9, trendReason: 'Mejor temporada en Serie A + capitán USMNT pre-Mundial 2026 organizado en EEUU',
    factors: { rendimiento: 80, contexto: 76, mediatico: 64, narrativa: 70 },
  },
  {
    id: 'lebron-cc', rank: 4, name: 'LeBron James', subtitle: 'LA Lakers · EEUU',
    sport: 'baloncesto', score: 69.2, trend: 'flat', region: 'concacaf', badge: 'Histórico',
    insight: 'A los 41 años en semifinales con los Lakers. Posible última temporada antes del retiro definitivo.',
    emoji: '🇺🇸', country: '🇺🇸',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/LeBron_James_%2851959977144%29_%28cropped2%29.jpg/330px-LeBron_James_%2851959977144%29_%28cropped2%29.jpg',
    scorePrev: 76.3, trendReason: '41 años, semifinal Lakers junto a Dončić — posible último baile competitivo',
    factors: { rendimiento: 70, contexto: 70, mediatico: 86, narrativa: 76 },
  },
  {
    id: 'reyna', rank: 5, name: 'Gio Reyna', subtitle: 'Borussia Dortmund · EEUU',
    sport: 'futbol', score: 60.5, trend: 'flat', region: 'concacaf',
    insight: 'Intermitente en Bundesliga pero con peso en la USMNT. Promesa que sigue buscando consagración definitiva.',
    emoji: '🇺🇸', country: '🇺🇸',
    scorePrev: 58.0, trendReason: 'Año intermitente en Bundesliga — sigue buscando la consagración definitiva',
    factors: { rendimiento: 62, contexto: 64, mediatico: 56, narrativa: 60 },
  },
]

// ── CLUBES ────────────────────────────────────────────────────────
export const RANKING_CLUBES: RankingEntry[] = [
  {
    id: 'psg', rank: 1, name: 'Paris Saint-Germain', subtitle: 'Ligue 1 · Francia',
    sport: 'futbol', score: 97.5, trend: 'up2', region: 'europa', badge: 'Nuevo',
    league: 'ligue1', country: 'france',
    insight: 'Cuádruplete histórico 2024/25: Ligue 1, Copa, Champions y Trofeo de Campeones. Final de Champions 5-0 al Inter en Múnich.',
    emoji: '🔵🔴',
    scorePrev: 85.3, trendReason: 'Cuádruplete histórico + Champions 5-0 vs Inter — Luis Enrique segundo entrenador con dos trebles',
    factors: { rendimiento: 99, contexto: 99, mediatico: 95, narrativa: 99 },
  },
  {
    id: 'liverpool', rank: 2, name: 'Liverpool', subtitle: 'Premier League · Inglaterra',
    sport: 'futbol', score: 92.5, trend: 'up2', region: 'europa',
    league: 'premier', country: 'england',
    insight: 'Campeón de Premier 2024/25 (20º título, iguala a ManU). Slot consolida la era post-Klopp con fichaje récord de Wirtz.',
    emoji: '🔴',
    scorePrev: 87.6, trendReason: 'Campeón Premier 2024/25 con 20º título — fichaje récord Wirtz para consolidar nueva era',
    factors: { rendimiento: 94, contexto: 93, mediatico: 90, narrativa: 92 },
  },
  {
    id: 'barcelona', rank: 3, name: 'FC Barcelona', subtitle: 'La Liga · España',
    sport: 'futbol', score: 91.2, trend: 'up', region: 'europa',
    league: 'laliga', country: 'spain',
    insight: 'Campeón de LaLiga 24/25 (28º título) bajo Flick. Era dorada continuada con Yamal lesionado al cierre y reto Champions pendiente.',
    emoji: '🔴🔵',
    scorePrev: 89.4, trendReason: 'LaLiga 24/25 con Flick — 28º título, pero Champions otra vez se le escapa',
    factors: { rendimiento: 92, contexto: 92, mediatico: 90, narrativa: 92 },
  },
  {
    id: 'thunder', rank: 4, name: 'OKC Thunder', subtitle: 'NBA · Oeste',
    sport: 'baloncesto', score: 90.8, trend: 'up2', badge: 'Histórico',
    league: 'nba', country: 'usa',
    insight: 'Campeón NBA 2025 (4-3 a los Pacers) y 68-14 en regular season. Primer anillo desde 1979 (Seattle SuperSonics).',
    emoji: '⚡',
    scorePrev: 90.2, trendReason: 'Campeón NBA 2025 + 68-14 regular season — primer anillo desde la era Seattle 1979',
    factors: { rendimiento: 96, contexto: 92, mediatico: 88, narrativa: 92 },
  },
  {
    id: 'arsenal', rank: 5, name: 'Arsenal', subtitle: 'Premier League · Inglaterra',
    sport: 'futbol', score: 88.7, trend: 'up', region: 'europa',
    league: 'premier', country: 'england',
    insight: 'Semifinalista de Champions 25/26 ante el Atlético. Cuatro temporadas aspirando al título Premier: la consolidación Arteta.',
    emoji: '🔴',
    scorePrev: 87.9, trendReason: 'Semifinal Champions 25/26 vs Atlético — proyecto Arteta consolidado a nivel europeo',
    factors: { rendimiento: 89, contexto: 89, mediatico: 86, narrativa: 89 },
  },
  {
    id: 'mcl-f1', rank: 6, name: 'McLaren', subtitle: 'Formula 1 · Constructores',
    sport: 'formula1', score: 88.2, trend: 'up2', region: 'europa', badge: 'Histórico',
    league: 'formula1', country: 'england',
    insight: 'Campeón de constructores y pilotos en 2025 (Norris). Primer doblete del equipo desde 1998. La nueva era está en Woking.',
    emoji: '🟠',
    scorePrev: 89.1, trendReason: 'Doblete constructores + pilotos 2025 con Norris — primer doblete desde 1998',
    factors: { rendimiento: 92, contexto: 90, mediatico: 86, narrativa: 92 },
  },
  {
    id: 'mancity', rank: 7, name: 'Manchester City', subtitle: 'Premier League · Inglaterra',
    sport: 'futbol', score: 84.5, trend: 'down2', region: 'europa',
    league: 'premier', country: 'england',
    insight: 'Sin Premier ni Champions por primera vez en años. Lesión de Haaland y reconstrucción del bloque tras el ciclo glorioso.',
    emoji: '🔵',
    scorePrev: 95.1, trendReason: 'Primera temporada sin Premier ni Champions tras la era dorada — reconstrucción a la vista',
    factors: { rendimiento: 84, contexto: 84, mediatico: 92, narrativa: 78 },
  },
  {
    id: 'realmadrid', rank: 8, name: 'Real Madrid', subtitle: 'La Liga · España',
    sport: 'futbol', score: 84.2, trend: 'down2', region: 'europa',
    league: 'laliga', country: 'spain',
    insight: 'Crisis institucional: tres entrenadores en una temporada (Ancelotti → Xabi Alonso → Arbeloa). Sin LaLiga ni Champions pese al Pichichi de Mbappé.',
    emoji: '⚪',
    scorePrev: 94.6, trendReason: 'Tres entrenadores en una temporada — sin títulos pese al Pichichi de Mbappé',
    factors: { rendimiento: 80, contexto: 78, mediatico: 96, narrativa: 78 },
  },
  {
    id: 'mercedes-f1', rank: 9, name: 'Mercedes', subtitle: 'Formula 1 · Constructores',
    sport: 'formula1', score: 87.4, trend: 'up2', region: 'europa', badge: 'Revelación',
    league: 'formula1', country: 'germany',
    insight: 'Líder del Mundial 2026 de constructores y pilotos (Antonelli + Russell). El cambio reglamentario favorece a Brackley.',
    emoji: '⚪',
    scorePrev: 75.0, trendReason: 'Lidera Mundial 2026 con Antonelli + Russell — el cambio reglamentario premia a Mercedes',
    factors: { rendimiento: 92, contexto: 87, mediatico: 84, narrativa: 88 },
  },
  {
    id: 'bayern', rank: 10, name: 'Bayern Munich', subtitle: 'Bundesliga · Alemania',
    sport: 'futbol', score: 86.0, trend: 'up', region: 'europa',
    league: 'bundesliga', country: 'germany',
    insight: 'Bundesliga 24/25 recuperada y semifinalista de Champions 25/26 ante el PSG. Vuelta al dominio doméstico alemán.',
    emoji: '🔴⚪',
    scorePrev: 88.2, trendReason: 'Bundesliga 24/25 recuperada + semifinal CL vs PSG — vuelta al dominio alemán',
    factors: { rendimiento: 88, contexto: 87, mediatico: 86, narrativa: 84 },
  },
  {
    id: 'inter', rank: 11, name: 'Inter de Milán', subtitle: 'Serie A · Italia',
    sport: 'futbol', score: 81.6, trend: 'down', region: 'europa',
    league: 'seriea', country: 'italy',
    insight: 'Final de Champions 0-5 contra el PSG y Scudetto fugado. La temporada más amarga del proyecto neroazzurro reciente.',
    emoji: '⚫🔵',
    scorePrev: 86.4, trendReason: 'Final de Champions 0-5 vs PSG y Scudetto perdido — peor temporada del ciclo Inzaghi',
    factors: { rendimiento: 84, contexto: 82, mediatico: 80, narrativa: 80 },
  },
  {
    id: 'celtics', rank: 12, name: 'Boston Celtics', subtitle: 'NBA · Este',
    sport: 'baloncesto', score: 84.3, trend: 'down', region: 'concacaf',
    league: 'nba', country: 'usa',
    insight: 'Defienden el anillo en semifinales 2026 contra los 76ers. La era Tatum-Brown sigue siendo top tier del Este.',
    emoji: '🍀',
    scorePrev: 88.9, trendReason: 'Semifinales 2026 vs 76ers — defienden anillo pero el Thunder ya es nuevo rey',
    factors: { rendimiento: 86, contexto: 85, mediatico: 84, narrativa: 82 },
  },
  {
    id: 'atletico', rank: 13, name: 'Atlético de Madrid', subtitle: 'La Liga · España',
    sport: 'futbol', score: 86.0, trend: 'up2', region: 'europa', badge: 'Revelación',
    league: 'laliga', country: 'spain',
    insight: 'Semifinalista de Champions 25/26 ante el Arsenal y subcampeón de LaLiga. La mejor temporada del Cholismo en años.',
    emoji: '🔴⚪',
    scorePrev: 84.8, trendReason: 'Semifinal Champions 25/26 + subcampeonato LaLiga — la mejor temporada del Cholismo en años',
    factors: { rendimiento: 88, contexto: 88, mediatico: 84, narrativa: 88 },
  },
  {
    id: 'chelsea', rank: 14, name: 'Chelsea', subtitle: 'Premier League · Inglaterra',
    sport: 'futbol', score: 83.2, trend: 'up2', region: 'europa', badge: 'Revelación',
    league: 'premier', country: 'england',
    insight: 'Campeón del Mundial de Clubes 2025 con un demoledor 3-0 al PSG. El proyecto Maresca consolidado tras años caóticos.',
    emoji: '🔵',
    scorePrev: 70.0, trendReason: 'Mundial de Clubes 2025 con 3-0 al PSG — Cole Palmer figura final, Maresca consolida proyecto',
    factors: { rendimiento: 86, contexto: 84, mediatico: 82, narrativa: 88 },
  },
  {
    id: 'redbull', rank: 15, name: 'Red Bull Racing', subtitle: 'Formula 1 · Constructores',
    sport: 'formula1', score: 79.8, trend: 'down2', region: 'europa', badge: 'Histórico',
    league: 'formula1', country: 'austria',
    insight: 'Subcampeón de constructores en 2025 y mal arranque 2026. Verstappen pierde el título por dos puntos: fin de la era dominante.',
    emoji: '🐂',
    scorePrev: 93.4, trendReason: 'Subcampeón 2025 y mal arranque 2026 — fin de la era dominante de Red Bull',
    factors: { rendimiento: 82, contexto: 78, mediatico: 86, narrativa: 76 },
  },
  {
    id: 'spurs', rank: 16, name: 'San Antonio Spurs', subtitle: 'NBA · Oeste',
    sport: 'baloncesto', score: 82.7, trend: 'up2', badge: 'Revelación',
    league: 'nba', country: 'usa',
    insight: 'Segundo cabeza de serie del Oeste con Wembanyama dominante. La reconstrucción más rápida del baloncesto NBA.',
    emoji: '⚫⚪',
    scorePrev: 70.0, trendReason: 'Segundo del Oeste con Wembanyama dominante — reconstrucción exprés tras Popovich',
    factors: { rendimiento: 88, contexto: 82, mediatico: 78, narrativa: 86 },
  },
  {
    id: 'ferrari', rank: 17, name: 'Ferrari', subtitle: 'Formula 1 · Constructores',
    sport: 'formula1', score: 81.5, trend: 'up', region: 'europa',
    league: 'formula1', country: 'italy',
    insight: 'Año pesadilla 2025 con Hamilton sin podios, pero la Scuderia recupera competitividad con la nueva regulación 2026.',
    emoji: '🔴',
    scorePrev: 87.3, trendReason: 'Pesadilla 2025 con Hamilton sin podios — pero recuperación competitiva en 2026',
    factors: { rendimiento: 80, contexto: 80, mediatico: 84, narrativa: 84 },
  },
  {
    id: 'lakers', rank: 18, name: 'LA Lakers', subtitle: 'NBA · Oeste',
    sport: 'baloncesto', score: 80.5, trend: 'up2', region: 'concacaf',
    league: 'nba', country: 'usa',
    insight: 'Semifinalistas con el trío Doncic-LeBron-Reaves. La adaptación post-traspaso de Luka funcionó mejor de lo esperado.',
    emoji: '💜💛',
    scorePrev: 70.0, trendReason: 'Semifinales 2026 con trío Dončić-LeBron-Reaves — adaptación post-traspaso exitosa',
    factors: { rendimiento: 82, contexto: 80, mediatico: 86, narrativa: 80 },
  },
  {
    id: 'leverkusen', rank: 19, name: 'Bayer Leverkusen', subtitle: 'Bundesliga · Alemania',
    sport: 'futbol', score: 79.0, trend: 'down', region: 'europa',
    league: 'bundesliga', country: 'germany',
    insight: 'Pierde a Wirtz y a Xabi Alonso pero mantiene proyecto sólido. La era post-doblete invicto se reinventa con éxito relativo.',
    emoji: '🔴⚫',
    scorePrev: 84.0, trendReason: 'Pierde Wirtz y Xabi Alonso — proyecto se reinventa pero sin la magia del doblete invicto',
    factors: { rendimiento: 80, contexto: 78, mediatico: 78, narrativa: 80 },
  },
  {
    id: 'nuggets', rank: 20, name: 'Denver Nuggets', subtitle: 'NBA · Oeste',
    sport: 'baloncesto', score: 78.5, trend: 'down2',
    league: 'nba', country: 'usa',
    insight: 'Eliminados en primera ronda pese a un Jokić de récord estadístico. El sistema de Denver acusa el desgaste.',
    emoji: '🏔️',
    scorePrev: 91.8, trendReason: 'Eliminados en primera ronda pese al MVP-level de Jokić — bajón competitivo claro',
    factors: { rendimiento: 80, contexto: 76, mediatico: 82, narrativa: 76 },
  },
  {
    id: 'riverplate', rank: 21, name: 'River Plate', subtitle: 'Liga Argentina · Argentina',
    sport: 'futbol', score: 78.0, trend: 'flat', region: 'latam',
    league: 'liga-arg', country: 'argentina',
    insight: 'El club más influyente de Sudamérica. Proyecto deportivo de largo plazo y semillero global de figuras emergentes.',
    emoji: '⚪🔴',
    scorePrev: 78.5, trendReason: 'Sigue siendo el club más influyente de Sudamérica — semillero y proyecto a largo plazo',
    factors: { rendimiento: 80, contexto: 78, mediatico: 76, narrativa: 80 },
  },
]

// ── LUCHADORAS — UFC FEMENINO ─────────────────────────────────────
export const RANKING_LUCHADORAS_UFC: RankingEntry[] = [
  {
    id: 'harrison', rank: 1, name: 'Kayla Harrison', subtitle: 'UFC · Campeona Peso Gallo',
    sport: 'ufc', score: 90.5, trend: 'up2', gender: 'f', region: 'concacaf', badge: 'Nuevo',
    insight: 'Campeona del peso gallo tras destronar a Julianna Peña. Ex doble medallista olímpica de judo y nueva cara dominante del MMA femenino.',
    emoji: '🇺🇸', country: '🇺🇸',
    scorePrev: 70.0, trendReason: 'Campeona peso gallo tras vencer a Peña — doble oro olímpico judo, nueva cara del MMA femenino',
    factors: { rendimiento: 94, contexto: 88, mediatico: 84, narrativa: 92 },
  },
  {
    id: 'shevchenko', rank: 2, name: 'Valentina Shevchenko', subtitle: 'UFC · Campeona Peso Mosca',
    sport: 'ufc', score: 90.2, trend: 'up', gender: 'f', badge: 'Histórico',
    insight: 'Recuperó el cinturón mosca ante Alexa Grasso en la trilogía. La técnica más fría y precisa del MMA femenino vuelve a reinar.',
    emoji: '🇰🇬', country: '🇰🇬',
    scorePrev: 93.8, trendReason: 'Recupera cinturón mosca en la trilogía vs Grasso — técnica fría y precisa intacta',
    factors: { rendimiento: 92, contexto: 92, mediatico: 86, narrativa: 92 },
  },
  {
    id: 'zhang-weili', rank: 3, name: 'Zhang Weili', subtitle: 'UFC · Campeona Peso Paja',
    sport: 'ufc', score: 89.8, trend: 'flat', gender: 'f',
    insight: 'Campeona del peso paja con dominio sostenido. La luchadora china más mediática y técnica del circuito.',
    emoji: '🇨🇳', country: '🇨🇳',
    scorePrev: 91.4, trendReason: 'Mantiene cinturón paja con dominio sostenido — referencia china y mundial',
    factors: { rendimiento: 92, contexto: 90, mediatico: 88, narrativa: 90 },
  },
  {
    id: 'nunes', rank: 4, name: 'Amanda Nunes', subtitle: 'UFC · Retirada',
    sport: 'ufc', score: 89.0, trend: 'down', gender: 'f', badge: 'Histórico',
    insight: 'La mayor luchadora de la historia UFC. Posibles rumores de regreso ante Harrison pero retirada oficial mantiene su legado intacto.',
    emoji: '🇧🇷', country: '🇧🇷',
    scorePrev: 97.2, trendReason: 'Retirada oficial pero rumores de regreso vs Harrison — el GOAT del MMA femenino',
    factors: { rendimiento: 86, contexto: 84, mediatico: 88, narrativa: 96 },
    editorialBoost: 1.5, editorialNote: 'Mejor luchadora MMA de la historia — protección de legado',
  },
  {
    id: 'grasso', rank: 5, name: 'Alexa Grasso', subtitle: 'UFC · Peso Mosca',
    sport: 'ufc', score: 84.4, trend: 'down', gender: 'f', region: 'latam',
    insight: 'Perdió el cinturón mosca en la trilogía ante Shevchenko. Sigue siendo la cara mexicana del MMA femenino mundial.',
    emoji: '🇲🇽', country: '🇲🇽',
    scorePrev: 88.6, trendReason: 'Pierde cinturón en trilogía vs Shevchenko — sigue siendo la referencia mexicana del MMA',
    factors: { rendimiento: 86, contexto: 82, mediatico: 84, narrativa: 88 },
  },
  {
    id: 'pena', rank: 6, name: 'Julianna Peña', subtitle: 'UFC · Peso Gallo',
    sport: 'ufc', score: 80.0, trend: 'down2', gender: 'f',
    insight: 'Perdió el cinturón gallo ante Kayla Harrison. La Venezolana queda en la búsqueda de revancha en una división renovada.',
    emoji: '🇺🇸', country: '🇺🇸',
    scorePrev: 85.3, trendReason: 'Pierde el cinturón gallo ante Harrison — busca revancha en una división renovada',
    factors: { rendimiento: 80, contexto: 78, mediatico: 80, narrativa: 84 },
  },
  {
    id: 'suarez', rank: 7, name: 'Tatiana Suarez', subtitle: 'UFC · Peso Paja',
    sport: 'ufc', score: 80.4, trend: 'up', gender: 'f', badge: 'Revelación',
    insight: 'Invicta en UFC con el wrestling más dominante del peso paja femenino. Próxima retadora de Zhang Weili confirmada.',
    emoji: '🇺🇸', country: '🇺🇸',
    scorePrev: 80.4, trendReason: 'Invicta en UFC — próxima retadora confirmada de Zhang Weili al cinturón paja',
    factors: { rendimiento: 84, contexto: 80, mediatico: 74, narrativa: 82 },
  },
  {
    id: 'namajunas', rank: 8, name: 'Rose Namajunas', subtitle: 'UFC · Peso Mosca',
    sport: 'ufc', score: 78.8, trend: 'flat', gender: 'f', badge: 'Histórico',
    insight: 'Dos reinados como campeona y un personaje único. Thug Rose vuelve a competir en peso mosca con perfil veterano.',
    emoji: '🇺🇸', country: '🇺🇸',
    scorePrev: 83.1, trendReason: 'Veterana en peso mosca — dos reinados como campeona y personalidad única intacta',
    factors: { rendimiento: 80, contexto: 80, mediatico: 78, narrativa: 80 },
  },
]

// ── CREADORES — WWE ───────────────────────────────────────────────
export const RANKING_CREADORES_WWE: RankingEntry[] = [
  {
    id: 'whatculture-wwe', rank: 1, name: 'WhatCulture Wrestling', subtitle: 'WWE · YouTube / Podcast',
    sport: 'wwe', score: 92.0, trend: 'up', badge: 'Histórico',
    insight: 'El mayor canal de wrestling en inglés. Reviews, listas y análisis que definen la conversación semanal del fandom global.',
    emoji: '🎬', country: '🇬🇧',
    scorePrev: 91.5, trendReason: 'Sigue siendo el mayor canal de wrestling en inglés — define la conversación semanal global',
    factors: { rendimiento: 92, contexto: 91, mediatico: 96, narrativa: 88 },
  },
  {
    id: 'cultaholic', rank: 2, name: 'Cultaholic Wrestling', subtitle: 'WWE · YouTube / Podcast',
    sport: 'wwe', score: 87.8, trend: 'up',
    insight: 'La alternativa más fresca al análisis mainstream. Humor inteligente y opiniones que no esquivan la controversia editorial.',
    emoji: '🤘', country: '🇬🇧',
    scorePrev: 87.3, trendReason: 'Alternativa fresca al análisis mainstream — humor inteligente y opinión sin filtros',
    factors: { rendimiento: 88, contexto: 86, mediatico: 88, narrativa: 87 },
  },
  {
    id: 'wregret', rank: 3, name: 'Wrestling with Wregret', subtitle: 'WWE · YouTube',
    sport: 'wwe', score: 83.6, trend: 'flat',
    insight: 'El crítico más influyente del wrestling clásico. Su archivo de reviews define el canon del fan exigente.',
    emoji: '📼', country: '🇺🇸',
    scorePrev: 83.6, trendReason: 'El crítico más influyente del wrestling clásico — define el canon del fan exigente',
    factors: { rendimiento: 84, contexto: 83, mediatico: 82, narrativa: 86 },
  },
  {
    id: 'wrestlelamia', rank: 4, name: 'Wrestlelamia', subtitle: 'WWE · YouTube / Shorts',
    sport: 'wwe', score: 81.0, trend: 'up', badge: 'Revelación',
    insight: 'Domina el formato corto aplicado al wrestling. Shorts y reels que llevan el deporte a nuevas audiencias jóvenes.',
    emoji: '⚡', country: '🇬🇧',
    scorePrev: 80.2, trendReason: 'Sigue dominando el formato corto para wrestling — Shorts y Reels llegan a nuevas audiencias',
    factors: { rendimiento: 83, contexto: 78, mediatico: 84, narrativa: 79 },
  },
  {
    id: 'grapsody', rank: 5, name: 'Grapsody', subtitle: 'WWE · Podcast / Audio',
    sport: 'wwe', score: 78.0, trend: 'up',
    insight: 'El podcast de análisis profundo más escuchado del circuito angloparlante. Ensayos sonoros sobre el negocio WWE.',
    emoji: '🎙️', country: '🇺🇸',
    scorePrev: 77.5, trendReason: 'Sigue siendo el podcast de análisis profundo más escuchado — ensayos sonoros sobre el negocio',
    factors: { rendimiento: 80, contexto: 77, mediatico: 75, narrativa: 81 },
  },
  {
    id: 'solomonster', rank: 6, name: 'Solomonster Sounds Off', subtitle: 'WWE · Podcast',
    sport: 'wwe', score: 72.2, trend: 'flat',
    insight: 'Veterano del podcasting de wrestling. Más de una década con fidelidad inquebrantable de la comunidad.',
    emoji: '🎧', country: '🇺🇸',
    scorePrev: 72.0, trendReason: 'Veterano del podcasting de wrestling — más de una década de fidelidad inquebrantable',
    factors: { rendimiento: 72, contexto: 72, mediatico: 70, narrativa: 74 },
  },
  // Destacados — creadores en español
  {
    id: 'popotillo', rank: 0, name: 'Mister Popotillo', subtitle: 'WWE en Español · YouTube',
    sport: 'wwe', score: 80.0, trend: 'up', featured: true,
    insight: 'El referente del wrestling en español. Comunidad hispanohablante consolidada y tono propio inconfundible.',
    emoji: '🇲🇽', country: '🇲🇽',
    scorePrev: 78.4, trendReason: 'Sigue siendo el referente del wrestling en español — comunidad consolidada',
    factors: { rendimiento: 82, contexto: 78, mediatico: 80, narrativa: 82 },
  },
  {
    id: 'wrestlespanol', rank: 0, name: 'Wrestling en Español', subtitle: 'WWE · TikTok / Instagram',
    sport: 'wwe', score: 74.0, trend: 'up2', featured: true,
    insight: 'El formato corto del wrestling en español. Crecimiento orgánico notable entre 18-24 en LATAM.',
    emoji: '🌎', country: '🇦🇷',
    scorePrev: 71.3, trendReason: 'Crecimiento sostenido del formato corto en español — fuerte entre 18-24 en LATAM',
    factors: { rendimiento: 76, contexto: 70, mediatico: 76, narrativa: 73 },
  },
]

// ── ENTRENADORES — solo Fútbol y NBA ─────────────────────────────
export const RANKING_ENTRENADORES: RankingEntry[] = [
  {
    id: 'luisenrique', rank: 1, name: 'Luis Enrique', subtitle: 'Paris Saint-Germain',
    sport: 'futbol', score: 97.4, trend: 'up2', region: 'europa', badge: 'Histórico',
    insight: 'Cuádruplete histórico con PSG (Ligue 1, Copa, Champions, Trofeo de Campeones). Segundo entrenador con dos trebles europeos junto a Guardiola.',
    emoji: '⚡',
    scorePrev: 87.3, trendReason: 'Cuádruplete histórico con PSG — segundo entrenador con dos trebles europeos junto a Guardiola',
    factors: { rendimiento: 99, contexto: 99, mediatico: 94, narrativa: 96 },
  },
  {
    id: 'slot', rank: 2, name: 'Arne Slot', subtitle: 'Liverpool',
    sport: 'futbol', score: 92.6, trend: 'up2', region: 'europa', badge: 'Revelación',
    insight: 'Premier League en su debut absoluto post-Klopp y fichaje récord de Wirtz. La sucesión más exitosa del fútbol moderno.',
    emoji: '🔴',
    scorePrev: 70.0, trendReason: 'Premier League en su debut tras Klopp — sucesión más exitosa del fútbol moderno',
    factors: { rendimiento: 96, contexto: 92, mediatico: 88, narrativa: 94 },
  },
  {
    id: 'flick', rank: 3, name: 'Hansi Flick', subtitle: 'FC Barcelona',
    sport: 'futbol', score: 90.5, trend: 'down', region: 'europa',
    insight: 'Campeón de LaLiga con el Barça y proyecto Yamal-Pedri-Lewandowski en marcha. Segundo año de consolidación deportiva.',
    emoji: '🔥',
    scorePrev: 91.0, trendReason: 'LaLiga 24/25 — pero Champions otra vez se le escapa al Barça campeón doméstico',
    factors: { rendimiento: 92, contexto: 90, mediatico: 88, narrativa: 90 },
  },
  {
    id: 'guardiola', rank: 4, name: 'Pep Guardiola', subtitle: 'Manchester City',
    sport: 'futbol', score: 89.4, trend: 'down2', region: 'europa', badge: 'Histórico',
    insight: 'Sin Premier ni Champions por primera vez en años. El pensamiento más avanzado del juego ante el reto de la reconstrucción.',
    emoji: '🧠',
    scorePrev: 96.8, trendReason: 'Primer año sin Premier ni Champions — el reto del ciclo de reconstrucción del City',
    factors: { rendimiento: 88, contexto: 86, mediatico: 92, narrativa: 90 },
  },
  {
    id: 'arteta', rank: 5, name: 'Mikel Arteta', subtitle: 'Arsenal',
    sport: 'futbol', score: 88.7, trend: 'up', region: 'europa',
    insight: 'Semifinal de Champions 25/26 ante el Atlético. La construcción más paciente y consistente de la Premier League actual.',
    emoji: '🎯',
    scorePrev: 89.5, trendReason: 'Semifinal Champions 25/26 — la construcción más paciente de la Premier League actual',
    factors: { rendimiento: 89, contexto: 88, mediatico: 86, narrativa: 90 },
  },
  {
    id: 'daigneault', rank: 6, name: 'Mark Daigneault', subtitle: 'OKC Thunder',
    sport: 'baloncesto', score: 88.2, trend: 'up2',
    insight: 'Campeón NBA 2025 y 68-14 en regular season. La cultura de equipo más sólida del basket actual.',
    emoji: '⚡',
    scorePrev: 84.8, trendReason: 'Campeón NBA + 68-14 regular season — cultura de equipo más sólida del basket actual',
    factors: { rendimiento: 92, contexto: 88, mediatico: 84, narrativa: 90 },
  },
  {
    id: 'simeone', rank: 7, name: 'Diego Simeone', subtitle: 'Atlético de Madrid',
    sport: 'futbol', score: 86.0, trend: 'up2', region: 'europa', badge: 'Histórico',
    insight: 'Semifinal de Champions y subcampeón de LaLiga: el Cholismo recupera su mejor versión competitiva en años.',
    emoji: '🦁',
    scorePrev: 78.0, trendReason: 'Semifinal Champions + subcampeonato LaLiga — el Cholismo recupera su mejor versión',
    factors: { rendimiento: 88, contexto: 87, mediatico: 84, narrativa: 86 },
  },
  {
    id: 'ancelotti', rank: 8, name: 'Carlo Ancelotti', subtitle: 'Selección de Brasil',
    sport: 'futbol', score: 85.0, trend: 'down', region: 'latam', badge: 'Histórico',
    insight: 'Salió del Madrid y tomó el banquillo de Brasil. Construye selección hacia el Mundial 2026 con su estilo gestión-emocional.',
    emoji: '🏆',
    scorePrev: 93.2, trendReason: 'Salida de Real Madrid + nuevo proyecto Brasil — referencia técnica para el Mundial 2026',
    factors: { rendimiento: 84, contexto: 82, mediatico: 90, narrativa: 88 },
  },
  {
    id: 'mazzulla', rank: 9, name: 'Joe Mazzulla', subtitle: 'Boston Celtics',
    sport: 'baloncesto', score: 84.0, trend: 'down',
    insight: 'Defiende anillo en semis 2026 ante 76ers. La era Mazzulla en Boston sigue siendo top tier del Este.',
    emoji: '🍀',
    scorePrev: 86.5, trendReason: 'Semifinales 2026 vs 76ers — defiende anillo pero el Thunder ya es nuevo rey',
    factors: { rendimiento: 86, contexto: 84, mediatico: 82, narrativa: 84 },
  },
]

// ── CREADORES — por deporte ───────────────────────────────────────
export const RANKING_CREADORES: RankingEntry[] = [
  {
    id: 'joma', rank: 1, name: 'JOMA', subtitle: 'Fútbol · YouTube / Instagram',
    sport: 'futbol', score: 94.0, trend: 'up',
    insight: 'El creador de fútbol con más engagement real en España. Comunidad y contenido alineados con la actualidad de élite.',
    emoji: '⚽',
    scorePrev: 93.5, trendReason: 'Sigue siendo el creador de fútbol con más engagement real en España',
    factors: { rendimiento: 95, contexto: 92, mediatico: 96, narrativa: 92 },
  },
  {
    id: 'ibai', rank: 2, name: 'Ibai Llanos', subtitle: 'Deportes & Entretenimiento · Twitch',
    sport: 'futbol', score: 92.0, trend: 'up2',
    insight: 'Productor de eventos deportivos masivos: La Velada del Año, Kings League, Euro Cup. Influencia transversal indiscutida.',
    emoji: '🎙️',
    scorePrev: 87.4, trendReason: 'La Velada del Año V + Kings League consolidada — productor de eventos deportivos masivos',
    factors: { rendimiento: 91, contexto: 90, mediatico: 96, narrativa: 91 },
  },
  {
    id: 'djmario', rank: 3, name: 'DjMariio', subtitle: 'Gaming + Fútbol · Twitch / YouTube',
    sport: 'futbol', score: 91.4, trend: 'up',
    insight: 'Puente sólido entre el gaming y el deporte real. Audiencia fiel y creciente con cobertura constante de actualidad fútbol.',
    emoji: '🎮',
    scorePrev: 91.2, trendReason: 'Puente sólido entre gaming y deporte real — audiencia fiel y creciente en dos mundos',
    factors: { rendimiento: 92, contexto: 90, mediatico: 92, narrativa: 90 },
  },
  {
    id: 'juanpe', rank: 4, name: 'Juanpe López', subtitle: 'Análisis táctico · Redes sociales',
    sport: 'futbol', score: 89.0, trend: 'up', badge: 'Revelación',
    insight: 'Democratiza el análisis táctico avanzado. La nueva escuela del periodismo deportivo en formato corto.',
    emoji: '📊',
    scorePrev: 88.6, trendReason: 'Sigue democratizando el análisis táctico avanzado — escuela del nuevo periodismo deportivo',
    factors: { rendimiento: 90, contexto: 86, mediatico: 88, narrativa: 92 },
  },
  {
    id: 'thegrefg', rank: 5, name: 'TheGrefg', subtitle: 'Gaming + Deporte · Twitch / YouTube',
    sport: 'futbol', score: 84.7, trend: 'flat',
    insight: 'Crossover deporte-entretenimiento consolidado. Pico de influencia estabilizado en el ecosistema digital.',
    emoji: '🃏',
    scorePrev: 84.7, trendReason: 'Crossover deporte-entretenimiento consolidado — pico de influencia estabilizado',
    factors: { rendimiento: 84, contexto: 84, mediatico: 88, narrativa: 82 },
  },
  {
    id: 'danchez-nba', rank: 1, name: 'Dan Sánchez', subtitle: 'NBA España · YouTube / TikTok',
    sport: 'baloncesto', score: 89.0, trend: 'up',
    insight: 'El referente del contenido NBA en español. Crecimiento sostenido y cobertura del histórico anillo del Thunder.',
    emoji: '🏀',
    scorePrev: 88.2, trendReason: 'Sigue siendo el referente del contenido NBA en español — cobertura del anillo Thunder',
    factors: { rendimiento: 90, contexto: 86, mediatico: 90, narrativa: 88 },
  },
  {
    id: 'marc-f1', rank: 1, name: 'Marc Gené Labs', subtitle: 'F1 Digital · YouTube',
    sport: 'formula1', score: 87.0, trend: 'up',
    insight: 'La voz más técnica y accesible de la F1 en español. Excelente cobertura del año del título de Norris y la nueva era 2026.',
    emoji: '🏎️',
    scorePrev: 86.5, trendReason: 'Cobertura del título Norris 2025 + nueva era 2026 — voz técnica y accesible en español',
    factors: { rendimiento: 88, contexto: 86, mediatico: 86, narrativa: 88 },
  },
  {
    id: 'tenis-creator', rank: 1, name: 'TennisVibez', subtitle: 'Tenis · Instagram / Reels',
    sport: 'tenis', score: 83.5, trend: 'up', badge: 'Revelación',
    insight: 'El formato de reels aplicado al tenis funciona. Cobertura del Career Slam de Alcaraz y Wimbledon de Sinner.',
    emoji: '🎾',
    scorePrev: 82.0, trendReason: 'Cobertura del Career Slam Alcaraz y dominio Sinner — formato corto efectivo en tenis',
    factors: { rendimiento: 85, contexto: 82, mediatico: 84, narrativa: 83 },
  },
  // Zona destacados (fuera del top pero con proyección)
  {
    id: 'destac-1', rank: 0, name: 'Álex Saorín', subtitle: 'Fútbol Táctico · Twitter / Substack',
    sport: 'futbol', score: 78.0, trend: 'up', featured: true,
    insight: 'La escritura táctica más profunda en castellano. Audiencia nicho pero muy fiel del análisis editorial profundo.',
    emoji: '✍️',
    scorePrev: 76.5, trendReason: 'Sigue siendo la escritura táctica más profunda en castellano — audiencia fiel',
    factors: { rendimiento: 79, contexto: 76, mediatico: 76, narrativa: 80 },
  },
  {
    id: 'destac-2', rank: 0, name: 'Nico Locorotondo', subtitle: 'NBA · TikTok',
    sport: 'baloncesto', score: 73.5, trend: 'up', featured: true,
    insight: 'El TikTok de baloncesto más original en Argentina. Narrativa fresca y viral con cobertura del anillo Thunder.',
    emoji: '🇦🇷',
    scorePrev: 72.3, trendReason: 'Sigue siendo el TikTok de basket más original en Argentina — cobertura anillo Thunder',
    factors: { rendimiento: 74, contexto: 70, mediatico: 74, narrativa: 76 },
  },
]

// ── PERIODISTAS — por deporte ─────────────────────────────────────
export const RANKING_PERIODISTAS: RankingEntry[] = [
  {
    id: 'helenaCondis', rank: 1, name: 'Helena Condis', subtitle: 'Movistar+ · TV & Digital',
    sport: 'futbol', score: 92.5, trend: 'up',
    insight: 'Periodismo de campo con rigor institucional y gran alcance digital. Cobertura privilegiada del Madrid en su año más caótico.',
    emoji: '📺',
    scorePrev: 92.1, trendReason: 'Cobertura privilegiada del Madrid en su año más caótico — rigor institucional intacto',
    factors: { rendimiento: 92, contexto: 92, mediatico: 94, narrativa: 91 },
  },
  {
    id: 'guillemBalague', rank: 2, name: 'Guillem Balagué', subtitle: 'Sky Sports · Internacional',
    sport: 'futbol', score: 91.4, trend: 'flat',
    insight: 'Profundidad analítica y acceso sin igual a vestuarios europeos de élite. Voz de referencia del fútbol español en inglés.',
    emoji: '🌍',
    scorePrev: 91.4, trendReason: 'Sigue siendo la voz internacional de referencia — acceso a vestuarios europeos de élite',
    factors: { rendimiento: 91, contexto: 92, mediatico: 91, narrativa: 92 },
  },
  {
    id: 'kikeMaturana', rank: 3, name: 'Kike Maturana', subtitle: 'Redes sociales · Periodismo digital',
    sport: 'futbol', score: 90.0, trend: 'up', badge: 'Revelación',
    insight: 'La nueva voz del periodismo deportivo. Velocidad y rigor en formato nativo digital con énfasis en el día a día Madrid.',
    emoji: '⚡',
    scorePrev: 89.2, trendReason: 'Sigue siendo la nueva voz del periodismo digital — cobertura intensiva del Madrid en crisis',
    factors: { rendimiento: 91, contexto: 87, mediatico: 92, narrativa: 89 },
  },
  {
    id: 'tomasRoncero', rank: 4, name: 'Tomás Roncero', subtitle: 'AS · Prensa & Digital',
    sport: 'futbol', score: 84.8, trend: 'flat',
    insight: 'Polarización como herramienta de alcance. Audiencia fiel y reconocible en el ecosistema digital del fútbol español.',
    emoji: '📰',
    scorePrev: 84.5, trendReason: 'Polarización como herramienta de alcance — audiencia fiel y reconocible',
    factors: { rendimiento: 83, contexto: 84, mediatico: 90, narrativa: 80 },
  },
  {
    id: 'pabloPozo', rank: 5, name: 'Pablo Pozo', subtitle: 'Marca · Digital & TV',
    sport: 'futbol', score: 81.5, trend: 'up',
    insight: 'Cobertura de eventos en directo con precisión. Referente en breaking news deportivo del fútbol español.',
    emoji: '🔔',
    scorePrev: 81.3, trendReason: 'Cobertura de eventos en directo con precisión — referente en breaking news',
    factors: { rendimiento: 82, contexto: 80, mediatico: 82, narrativa: 80 },
  },
  {
    id: 'nba-journalist', rank: 1, name: 'Shams Charania', subtitle: 'ESPN · NBA Insider Global',
    sport: 'baloncesto', score: 91.0, trend: 'up',
    insight: 'Insider NBA más activo del mundo: cubrió el anillo Thunder, los traspasos Doncic-Lakers y la era SGA con primicias diarias.',
    emoji: '🏀',
    scorePrev: 88.0, trendReason: 'Insider más activo del mundo NBA — primicias diarias del anillo Thunder y mercado',
    factors: { rendimiento: 91, contexto: 89, mediatico: 94, narrativa: 90 },
  },
  {
    id: 'f1-journalist', rank: 1, name: 'Nico Rosberg', subtitle: 'F1 Análisis · YouTube & DAZN',
    sport: 'formula1', score: 89.0, trend: 'up',
    insight: 'Ex campeón del mundo con visión técnica única. Cobertura de la era post-Verstappen y la transición reglamentaria 2026.',
    emoji: '🏎️',
    scorePrev: 88.3, trendReason: 'Ex campeón con visión técnica única — cobertura de la era post-Verstappen y nuevo reglamento',
    factors: { rendimiento: 89, contexto: 88, mediatico: 88, narrativa: 91 },
  },
  {
    id: 'tenis-journalist', rank: 1, name: 'José Morgado', subtitle: 'Freelance ATP · Digital',
    sport: 'tenis', score: 86.0, trend: 'up',
    insight: 'El periodista de tenis más confiable del circuito. Fuente primaria del Career Slam de Alcaraz y la era Sinner.',
    emoji: '🎾',
    scorePrev: 85.0, trendReason: 'Fuente primaria del Career Slam Alcaraz y era Sinner — referencia confiable del circuito',
    factors: { rendimiento: 87, contexto: 86, mediatico: 84, narrativa: 87 },
  },
  // Destacados
  {
    id: 'destac-per-1', rank: 0, name: 'Adriana Cisneros', subtitle: 'ESPN Deportes · LatAm',
    sport: 'futbol', score: 76.0, trend: 'up', featured: true,
    insight: 'La periodista deportiva latinoamericana con más proyección. Crecimiento sostenido en ESPN Deportes con cobertura Mundial 2026.',
    emoji: '🇲🇽',
    scorePrev: 74.8, trendReason: 'Crecimiento sostenido en ESPN Deportes — cobertura previa al Mundial 2026',
    factors: { rendimiento: 76, contexto: 74, mediatico: 78, narrativa: 78 },
  },
]

// ── Scope types ───────────────────────────────────────────────────
export type JugadoresScope = 'global' | 'liga' | 'posicion' | 'sub21' | 'pais'
export type ClubesScope    = 'global' | 'liga' | 'pais'

// ── Index ────────────────────────────────────────────────────────
export const RANKINGS_BY_TAB: Record<RankingTab, RankingEntry[]> = {
  jugadores:    RANKING_JUGADORES,
  clubes:       RANKING_CLUBES,
  entrenadores: RANKING_ENTRENADORES,
  creadores:    RANKING_CREADORES,
  periodistas:  RANKING_PERIODISTAS,
}

export const RANKING_TABS: { id: RankingTab; label: string }[] = [
  { id: 'jugadores',    label: 'Jugadores'    },
  { id: 'clubes',       label: 'Clubes'       },
  { id: 'entrenadores', label: 'Entrenadores' },
  { id: 'creadores',    label: 'Creadores'    },
  { id: 'periodistas',  label: 'Periodistas'  },
]

// ── Scope tabs ────────────────────────────────────────────────────
export const JUGADORES_SCOPE_TABS: { id: JugadoresScope; label: string }[] = [
  { id: 'global',   label: 'Global'       },
  { id: 'liga',     label: 'Por liga'     },
  { id: 'posicion', label: 'Por posición' },
  { id: 'sub21',    label: 'Sub-25'       },
  { id: 'pais',     label: 'Por país'     },
]

export const CLUBES_SCOPE_TABS: { id: ClubesScope; label: string }[] = [
  { id: 'global', label: 'Global'    },
  { id: 'liga',   label: 'Por liga'  },
  { id: 'pais',   label: 'Por país'  },
]

// ── Filter lists ──────────────────────────────────────────────────
export const JUGADORES_LIGA_FILTERS = [
  { label: 'Todas',      slug: '' },
  { label: 'LaLiga',     slug: 'laliga' },
  { label: 'Premier',    slug: 'premier' },
  { label: 'Bundesliga', slug: 'bundesliga' },
  { label: 'Serie A',    slug: 'seriea' },
  { label: 'Ligue 1',    slug: 'ligue1' },
  { label: 'NBA',        slug: 'nba' },
  { label: 'ATP/WTA',    slug: 'atp' },
  { label: 'MLS',        slug: 'mls' },
]

export const JUGADORAS_LIGA_FILTERS = [
  { label: 'Todas',        slug: '' },
  { label: 'Liga F',       slug: 'ligaf' },
  { label: 'WSL',          slug: 'wsl' },
  { label: 'NWSL',         slug: 'nwsl' },
  { label: 'Division 1 F', slug: 'div1f' },
  { label: 'Champions F',  slug: 'championsf' },
  { label: 'Frauen-BL',    slug: 'frauenbl' },
]

export const CLUBES_LIGA_FILTERS = [
  { label: 'Todas',      slug: '' },
  { label: 'LaLiga',     slug: 'laliga' },
  { label: 'Premier',    slug: 'premier' },
  { label: 'Bundesliga', slug: 'bundesliga' },
  { label: 'Serie A',    slug: 'seriea' },
  { label: 'Ligue 1',    slug: 'ligue1' },
  { label: 'NBA',        slug: 'nba' },
  { label: 'F1',         slug: 'formula1' },
]

export const CLUBES_FEMENINO_LIGA_FILTERS = [
  { label: 'Todas',       slug: '' },
  { label: 'Liga F',      slug: 'ligaf' },
  { label: 'Champions F', slug: 'championsf' },
  { label: 'WSL',         slug: 'wsl' },
  { label: 'Frauen-BL',   slug: 'frauenbl' },
]

export const CLUBES_PAIS_FILTERS = [
  { label: 'Todos',          slug: '' },
  { label: '🇪🇸 España',     slug: 'spain' },
  { label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra', slug: 'england' },
  { label: '🇮🇹 Italia',     slug: 'italy' },
  { label: '🇩🇪 Alemania',   slug: 'germany' },
  { label: '🇫🇷 Francia',    slug: 'france' },
  { label: '🇺🇸 EEUU',       slug: 'usa' },
  { label: '🌎 Otras',       slug: 'other' },
]

export const JUGADORES_PAIS_REGIONS: { id: string; label: string; emoji: string }[] = [
  { id: 'europa',   label: 'Europa',   emoji: '🇪🇺' },
  { id: 'latam',    label: 'Latam',    emoji: '🌎' },
  { id: 'concacaf', label: 'Concacaf', emoji: '🏔️' },
]

export const JUGADORES_POSITION_FILTERS = [
  { label: 'Todas',          slug: '' },
  // Fútbol
  { label: 'Delantero',      slug: 'delantero' },
  { label: 'Extremo',        slug: 'extremo' },
  { label: 'Mediapunta',     slug: 'mediapunta' },
  { label: 'Centrocampista', slug: 'centrocampista' },
  { label: 'Defensa',        slug: 'defensa' },
  { label: 'Portero',        slug: 'portero' },
  // NBA
  { label: 'Base',           slug: 'base' },
  { label: 'Escolta',        slug: 'escolta' },
  { label: 'Alero',          slug: 'alero' },
  { label: 'Ala-Pívot',      slug: 'ala-pivote' },
  { label: 'Pívot',          slug: 'pivote' },
]
