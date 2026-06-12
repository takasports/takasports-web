// ── Fuente única de competiciones de fútbol (ESPN) ──────────────────────────
// Lista maestra consumida por el calendario (lib/espn.ts), el feed en vivo
// (api/events/live) y los próximos (api/events/upcoming). Antes vivía duplicada
// en los tres sitios y se desincronizaba; ahora se deriva de aquí.
//
// `live: true` → la competición entra en el polling en vivo (/api/events/live).
// Reservado para las relevantes/activas; las demás igualmente aparecen en el
// calendario y en resultados, solo sin marcador minuto a minuto.

export interface FootballLeague {
  /** Slug ESPN, p.ej. 'soccer/esp.1'. */
  slug: string
  /** Nombre mostrado y clave de color/ranking (lib/competitions). */
  comp: string
  /** Incluir en el feed en vivo. */
  live: boolean
  /** Competición femenina. Clubes y selecciones comparten nombre con su
   *  homónimo masculino, así que el detalle de partido usa este flag (vía
   *  WOMENS_SLUGS) para no cruzar H2H/forma entre géneros. */
  women?: boolean
  /** Ventana de futuros (días) mayor que los 21 por defecto. Torneos largos
   *  (Mundial: 38 días) la necesitan para que el fixture completo entre. */
  daysAhead?: number
  /** Tope de eventos por scoreboard mayor que el de por defecto. El Mundial
   *  tiene 104 partidos; sin esto ESPN corta la lista y faltan partidos. */
  fetchLimit?: number
}

export const FOOTBALL_LEAGUES: FootballLeague[] = [
  // UEFA — clubes
  { slug: 'soccer/uefa.champions',      comp: 'Champions',          live: true  },
  { slug: 'soccer/uefa.europa',         comp: 'Europa',             live: true  },
  { slug: 'soccer/uefa.europa.conf',    comp: 'Conference',         live: true  },
  { slug: 'soccer/uefa.super_cup',      comp: 'Super Cup',          live: true  },
  // Selecciones / FIFA
  { slug: 'soccer/fifa.world',          comp: 'Mundial',            live: true,  daysAhead: 45, fetchLimit: 250 },
  { slug: 'soccer/fifa.cwc',            comp: 'Mundial de Clubes',  live: true  },
  { slug: 'soccer/fifa.friendly',       comp: 'Amistoso',           live: true  },
  { slug: 'soccer/fifa.friendly.w',     comp: 'Amistoso (F)',       live: true,  women: true },
  { slug: 'soccer/uefa.nations',        comp: 'Nations',            live: true  },
  { slug: 'soccer/uefa.euro',           comp: 'Eurocopa',           live: true  },
  { slug: 'soccer/conmebol.america',    comp: 'Copa América',       live: true  },
  { slug: 'soccer/concacaf.gold',       comp: 'Gold Cup',           live: true  },
  // Ligas top europeas
  { slug: 'soccer/esp.1',               comp: 'LaLiga',             live: true  },
  { slug: 'soccer/eng.1',               comp: 'Premier',            live: true  },
  { slug: 'soccer/ita.1',               comp: 'Serie A',            live: true  },
  { slug: 'soccer/ger.1',               comp: 'Bundesliga',         live: true  },
  { slug: 'soccer/fra.1',               comp: 'Ligue 1',            live: true  },
  { slug: 'soccer/por.1',               comp: 'Primeira',           live: true  },
  { slug: 'soccer/ned.1',               comp: 'Eredivisie',         live: true  },
  // Fútbol femenino
  { slug: 'soccer/esp.w.1',             comp: 'Liga F',             live: true,  women: true },
  // Copas nacionales
  { slug: 'soccer/esp.copa_del_rey',    comp: 'Copa Rey',           live: true  },
  { slug: 'soccer/eng.fa',              comp: 'FA Cup',             live: true  },
  { slug: 'soccer/eng.league_cup',      comp: 'Carabao Cup',        live: false },
  { slug: 'soccer/ita.coppa_italia',    comp: 'Copa Italia',        live: false },
  { slug: 'soccer/ger.dfb_pokal',       comp: 'DFB Pokal',          live: false },
  { slug: 'soccer/fra.coupe_de_france', comp: 'Copa Francia',       live: false },
  // Otras ligas europeas
  { slug: 'soccer/eng.2',               comp: 'Championship',       live: false },
  { slug: 'soccer/esp.2',               comp: 'LaLiga 2',           live: false },
  { slug: 'soccer/tur.1',               comp: 'Süper Lig',          live: false },
  { slug: 'soccer/bel.1',               comp: 'Pro League',         live: false },
  { slug: 'soccer/sco.1',               comp: 'Premiership',        live: false },
  // Américas / resto del mundo
  { slug: 'soccer/conmebol.libertadores', comp: 'Libertadores',        live: true  },
  { slug: 'soccer/concacaf.champions',    comp: 'Concacaf',            live: false },
  { slug: 'soccer/usa.1',               comp: 'MLS',                live: true  },
  { slug: 'soccer/mex.1',               comp: 'Liga MX',            live: true  },
  { slug: 'soccer/bra.1',               comp: 'Brasileirão',        live: true  },
  { slug: 'soccer/arg.1',               comp: 'Liga Argentina',     live: false },
  { slug: 'soccer/ksa.1',               comp: 'Saudi Pro League',    live: false },
  { slug: 'soccer/jpn.1',               comp: 'J-League',           live: false },
]

/** Subconjunto que entra en el feed en vivo. */
export const LIVE_FOOTBALL = FOOTBALL_LEAGUES.filter((l) => l.live)

/** Ligas regulares (round-robin) con clasificación disponible en ESPN. Las
 *  copas y torneos de selecciones se excluyen (no tienen tabla simple). Se usa
 *  en el detalle de partido (/partido) para mostrar la tabla de la liga. */
export const TABLE_LEAGUE_SLUGS = new Set<string>([
  'soccer/uefa.champions',
  'soccer/esp.1', 'soccer/eng.1', 'soccer/ita.1', 'soccer/ger.1', 'soccer/fra.1',
  'soccer/por.1', 'soccer/ned.1', 'soccer/eng.2', 'soccer/esp.2', 'soccer/tur.1',
  'soccer/bel.1', 'soccer/sco.1', 'soccer/usa.1', 'soccer/mex.1', 'soccer/bra.1',
  'soccer/arg.1', 'soccer/ksa.1', 'soccer/jpn.1', 'soccer/esp.w.1',
])

/** Mapa slug → nombre mostrado, para etiquetar el detalle de partido. */
export const LEAGUE_LABEL_BY_SLUG: Record<string, string> =
  Object.fromEntries(FOOTBALL_LEAGUES.map((l) => [l.slug, l.comp]))

/** Slugs de competiciones femeninas (derivado del flag `women`, fuente única).
 *  Clubes y selecciones comparten nombre con su homónimo masculino ("Real
 *  Madrid", "Barcelona", "España"…); este conjunto permite no cruzar H2H ni
 *  forma reciente entre géneros en el detalle de partido. */
export const WOMENS_SLUGS: ReadonlySet<string> = new Set(
  FOOTBALL_LEAGUES.filter((l) => l.women).map((l) => l.slug),
)

/** ¿El slug de liga corresponde a una competición femenina? */
export function isWomensSlug(slug: string | undefined | null): boolean {
  return !!slug && WOMENS_SLUGS.has(slug)
}

/** Etiquetas `comp` de competiciones femeninas (derivado del flag `women`).
 *  En el calendario los eventos llevan `comp` (no slug), así que esta es la
 *  vía para saber el género de un evento y no cruzar su forma reciente con la
 *  del equipo masculino homónimo. */
export const WOMENS_COMPS: ReadonlySet<string> = new Set(
  FOOTBALL_LEAGUES.filter((l) => l.women).map((l) => l.comp),
)

/** ¿La etiqueta de competición es femenina? */
export function isWomensComp(comp: string | undefined | null): boolean {
  return !!comp && WOMENS_COMPS.has(comp)
}
