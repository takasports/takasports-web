// Nombre legible de una competición a partir de su slug de ESPN.
//
// Por qué existe: este mapa estaba DUPLICADO en `/api/match/[ref]` y en
// `/api/jugador/[slug]`, con contenidos distintos —uno tenía Europa League y el
// otro F1— y solo 9-12 entradas cada uno. Todo lo que no estuviera caía al
// nombre crudo de ESPN, en inglés y a veces con erratas suyas: la ficha de
// Altin Gjokaj se titulaba "UEFA Europa League Qualfiying" y ese título se
// indexa en Google. Detectado el 31/08/2026 al publicar 7.046 fichas de jugador.
//
// Las claves salen de los slugs que de verdad aparecen en `sport_entities`
// (consultado el 31/08/2026), no de una lista imaginada.

/** Slug de ESPN → nombre que enseñamos. */
export const COMPETITION_LABELS: Record<string, string> = {
  // Fútbol — grandes ligas
  'soccer/esp.1':                 'LaLiga',
  'soccer/esp.2':                 'LaLiga Hypermotion',
  'soccer/esp.w.1':               'Liga F',
  'soccer/eng.1':                 'Premier League',
  'soccer/eng.2':                 'Championship',
  'soccer/eng.5':                 'National League',
  'soccer/ita.1':                 'Serie A',
  'soccer/ita.2':                 'Serie B',
  'soccer/ger.1':                 'Bundesliga',
  'soccer/fra.1':                 'Ligue 1',
  'soccer/por.1':                 'Primeira Liga',
  'soccer/ned.1':                 'Eredivisie',
  'soccer/bel.1':                 'Pro League',
  'soccer/sco.1':                 'Premiership de Escocia',
  'soccer/tur.1':                 'Superliga de Turquía',
  'soccer/rus.1':                 'Premier League de Rusia',
  'soccer/rou.1':                 'Liga I de Rumanía',
  'soccer/ksa.1':                 'Liga Saudí',
  'soccer/jpn.1':                 'J1 League',

  // Fútbol — América
  'soccer/usa.1':                 'MLS',
  'soccer/usa.open':              'US Open Cup',
  'soccer/usa.usl.l1':            'USL League One',
  'soccer/mex.1':                 'Liga MX',
  'soccer/bra.1':                 'Brasileirão',
  'soccer/arg.1':                 'Liga Profesional Argentina',

  // Fútbol — copas nacionales
  'soccer/esp.copa_del_rey':      'Copa del Rey',
  'soccer/eng.fa':                'FA Cup',
  'soccer/eng.league_cup':        'Carabao Cup',
  'soccer/eng.trophy':            'EFL Trophy',
  'soccer/ita.coppa_italia':      'Coppa Italia',
  'soccer/ger.dfb_pokal':         'DFB-Pokal',
  'soccer/fra.coupe_de_france':   'Copa de Francia',

  // Fútbol — competiciones internacionales de clubes
  'soccer/uefa.champions':        'Champions League',
  'soccer/uefa.europa':           'Europa League',
  'soccer/uefa.conference':       'Conference League',
  'soccer/uefa.europa.conf':      'Conference League',
  'soccer/uefa.super_cup':        'Supercopa de Europa',
  'soccer/concacaf.champions':    'Concachampions',
  'soccer/conmebol.libertadores': 'Copa Libertadores',
  'soccer/fifa.cwc':              'Mundial de Clubes',

  // Fútbol — previas. ESPN escribe "Qualfiying" (sic) en varias de ellas.
  'soccer/uefa.champions_qual':   'Previa de Champions',
  'soccer/uefa.europa_qual':      'Previa de Europa League',
  'soccer/uefa.europa.conf_qual': 'Previa de Conference League',

  // Fútbol — selecciones
  'soccer/fifa.world':            'Mundial',
  'soccer/fifa.friendly':         'Amistosos internacionales',
  'soccer/fifa.friendly.w':       'Amistosos internacionales femeninos',
  'soccer/uefa.nations':          'Liga de Naciones',
  'soccer/uefa.euro':             'Eurocopa',
  'soccer/conmebol.america':      'Copa América',
  'soccer/concacaf.gold':         'Copa Oro',

  // Otros deportes
  'basketball/nba':               'NBA',
  'racing/f1':                    'Fórmula 1',
  'mma/ufc':                      'UFC',
  'tennis/atp':                   'ATP',
  'tennis/wta':                   'WTA',
  'golf/pga':                     'PGA Tour',
}

/**
 * Erratas de ESPN que llegan en el nombre crudo. Van aparte del mapa porque
 * afectan a CUALQUIER competición sin mapear, no solo a las conocidas.
 */
const ERRATAS_ESPN: Array<[RegExp, string]> = [
  [/\bQualfiying\b/gi, 'Qualifying'],
]

/** Limpia el nombre que manda ESPN cuando no tenemos mapeo propio. */
export function limpiarEtiquetaEspn(nombre: string): string {
  let out = nombre.trim().replace(/\s+/g, ' ')
  for (const [re, bien] of ERRATAS_ESPN) out = out.replace(re, bien)
  return out
}

/**
 * Nombre a enseñar para una competición.
 *
 * Orden: nuestro mapa → el nombre de ESPN ya limpio → el slug pelado. Nunca
 * devuelve cadena vacía: un título a medias es peor que un slug feo.
 */
export function competitionLabel(
  slug: string | null | undefined,
  espnFallback?: string | null,
): string {
  const s = (slug ?? '').trim()
  const propio = COMPETITION_LABELS[s]
  if (propio) return propio
  const deEspn = (espnFallback ?? '').trim()
  if (deEspn) return limpiarEtiquetaEspn(deEspn)
  return s
}
