// Parser del `matchRef` que identifica un partido en toda la web:
// /partido/[ref], /api/match/[ref], los recordatorios push y las tarjetas del
// calendario usan el mismo string.
//
// Forma: "<sport>_<league>_<eventId>" — p. ej. "soccer_esp.1_401882917".
//
// El detalle que importa: se corta por el PRIMER '_' y por el ÚLTIMO, nunca por
// todos. El slug de liga de ESPN lleva guiones bajos propios en las seis copas
// nacionales del catálogo (eng.league_cup, esp.copa_del_rey, ita.coppa_italia,
// ger.dfb_pokal, fra.coupe_de_france, uefa.super_cup), así que un split('_') a
// secas convertía "soccer_eng.league_cup_401908119" en "soccer/eng.league/cup",
// ESPN devolvía 404 y la ficha salía como "Partido no encontrado".
//
// Es el inverso exacto de cómo se construye: `${slug.replace('/', '_')}_${id}`
// en /api/events/upcoming sustituye solo la PRIMERA barra. El eventId es
// siempre el id numérico de ESPN, que no lleva guiones bajos.

export interface ParsedMatchRef {
  /** Slug de ESPN listo para la URL de la API: "soccer/eng.league_cup" */
  leagueSlug: string
  /** Id numérico del evento en ESPN */
  eventId: string
}

export function parseMatchRef(ref: string): ParsedMatchRef | null {
  if (!ref) return null

  const first = ref.indexOf('_')
  const last  = ref.lastIndexOf('_')
  // Hacen falta al menos dos '_' distintos, y el deporte no puede ir vacío.
  if (first < 1 || last === first) return null

  const sport   = ref.slice(0, first)
  const league  = ref.slice(first + 1, last)
  const eventId = ref.slice(last + 1)
  if (!league || !eventId) return null

  return { leagueSlug: `${sport}/${league}`, eventId }
}
