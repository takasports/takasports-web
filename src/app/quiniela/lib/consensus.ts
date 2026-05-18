// Carga del consenso real por jornada (votos reales vía Supabase RPC).
// Cache a nivel de módulo: un fetch por jornada compartido entre todas
// las cards (ConsensusBar + cuotas vivas en MatchCard).

export interface ConsensusRow {
  home: string
  away: string
  p1: number
  px: number
  p2: number
  total: number
}

const cache = new Map<string, Promise<ConsensusRow[]>>()

export function loadConsensus(jornada: string): Promise<ConsensusRow[]> {
  const cached = cache.get(jornada)
  if (cached) return cached
  const p = fetch(`/api/quiniela/consensus?jornada=${encodeURIComponent(jornada)}`, { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : { rows: [] }))
    .then(j => (j.rows ?? []) as ConsensusRow[])
    .catch(() => [] as ConsensusRow[])
  cache.set(jornada, p)
  return p
}
