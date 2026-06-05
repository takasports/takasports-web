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
}

export const FOOTBALL_LEAGUES: FootballLeague[] = [
  // UEFA — clubes
  { slug: 'soccer/uefa.champions',      comp: 'Champions',          live: true  },
  { slug: 'soccer/uefa.europa',         comp: 'Europa',             live: true  },
  { slug: 'soccer/uefa.europa.conf',    comp: 'Conference',         live: true  },
  { slug: 'soccer/uefa.super_cup',      comp: 'Super Cup',          live: true  },
  // Selecciones / FIFA
  { slug: 'soccer/fifa.world',          comp: 'Mundial',            live: true  },
  { slug: 'soccer/fifa.cwc',            comp: 'Mundial de Clubes',  live: true  },
  { slug: 'soccer/fifa.friendly',       comp: 'Amistoso',           live: true  },
  { slug: 'soccer/fifa.friendly.w',     comp: 'Amistoso (F)',       live: true  },
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
