// Categoría de los «Líderes» de baloncesto en español.
//
// /api/match pasa tal cual el `displayName` de ESPN («Points», «Assists»,
// «Rebounds»…) y la ficha del partido lo pintaba en inglés: «28 Points». Antes
// del partido ESPN manda las medias con el mismo nombre (name `pointsPerGame`,
// displayName «Points»). Lo que no esté en el diccionario sale como llega.

const CATEGORIAS: Record<string, string> = {
  points: 'Puntos',
  pointspergame: 'Puntos',
  assists: 'Asistencias',
  assistspergame: 'Asistencias',
  rebounds: 'Rebotes',
  reboundspergame: 'Rebotes',
  'total rebounds': 'Rebotes',
  'offensive rebounds': 'Rebotes ofensivos',
  'defensive rebounds': 'Rebotes defensivos',
  steals: 'Robos',
  stealspergame: 'Robos',
  blocks: 'Tapones',
  blockspergame: 'Tapones',
  turnovers: 'Pérdidas',
  fouls: 'Faltas',
  minutes: 'Minutos',
  'field goals': 'Tiros de campo',
  'field goal %': 'Tiros de campo %',
  'field goal percentage': 'Tiros de campo %',
  '3-pointers': 'Triples',
  'three pointers': 'Triples',
  '3-point field goals': 'Triples',
  'three point %': 'Triples %',
  '3-point %': 'Triples %',
  'free throws': 'Tiros libres',
  'free throw %': 'Tiros libres %',
  rating: 'Valoración',
  'plus/minus': 'Más/menos',
}

export function categoriaLiderNBA(categoria: string | undefined | null): string {
  const raw = (categoria ?? '').trim()
  if (!raw) return ''
  return CATEGORIAS[raw.toLowerCase()] ?? raw
}
