// Log de partidos POR JUGADOR desde ESPN gamelog. Da la línea del jugador en cada
// partido (goles, asistencias, tiros, tarjetas) + rival, marcador y resultado — mejor que
// los partidos del club que mostrábamos antes. El endpoint es por atleta (sin liga):
//   site.web.api.espn.com/apis/common/v3/sports/{sport}/athletes/{id}/gamelog
// Estructura: `names` define las columnas; cada fila en seasonTypes[].categories[].events[]
// trae `stats` alineados a `names` y un `eventId` que cruza con el mapa `events`.

export interface MatchLogEntry {
  eventId: string
  date: string                     // ISO
  opponent: string
  opponentAbbr?: string
  opponentLogo?: string
  homeAway: string                 // 'vs' | '@'
  score?: string                   // "4-2"
  result?: string                  // 'W' | 'L' | 'D'
  league?: string
  stats: Record<string, number>    // { totalGoals, goalAssists, totalShots, ... }
}

interface GamelogEvent {
  gameDate?: string
  atVs?: string
  score?: string
  gameResult?: string
  leagueName?: string
  opponent?: { id?: string; displayName?: string; abbreviation?: string }
}

export async function fetchPlayerGamelog(
  espnPath: string,   // 'soccer' o 'basketball/nba' — NBA EXIGE el segmento de liga (fútbol no)
  playerId: string,
  limit = 8,
): Promise<MatchLogEntry[]> {
  // Ruta del CDN de escudos: baloncesto guarda los logos bajo 'nba', fútbol bajo 'soccer'.
  const logoSport = espnPath.startsWith('basketball') ? 'nba' : espnPath.split('/')[0]
  let json: Record<string, unknown>
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/${espnPath}/athletes/${playerId}/gamelog`,
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return []
    json = (await res.json()) as Record<string, unknown>
  } catch {
    return []
  }

  const names = Array.isArray(json.names) ? (json.names as string[]) : []
  const eventsMeta = (json.events ?? {}) as Record<string, GamelogEvent>
  const seasonTypes = Array.isArray(json.seasonTypes) ? json.seasonTypes : []

  const out: MatchLogEntry[] = []
  for (const st of seasonTypes as Array<{ categories?: Array<{ events?: Array<{ eventId?: string; stats?: unknown[] }> }> }>) {
    for (const cat of st.categories ?? []) {
      for (const row of cat.events ?? []) {
        const meta = row.eventId ? eventsMeta[row.eventId] : undefined
        if (!meta || !row.eventId) continue
        const stats: Record<string, number> = {}
        const vals = Array.isArray(row.stats) ? row.stats : []
        names.forEach((name, i) => {
          const v = Number(vals[i])
          if (Number.isFinite(v)) stats[name] = v
        })
        const opp = meta.opponent ?? {}
        out.push({
          eventId: String(row.eventId),
          date: String(meta.gameDate ?? ''),
          opponent: String(opp.displayName ?? ''),
          opponentAbbr: opp.abbreviation ? String(opp.abbreviation) : undefined,
          opponentLogo: opp.id
            ? `https://a.espncdn.com/i/teamlogos/${logoSport}/500/${opp.id}.png`
            : undefined,
          homeAway: String(meta.atVs ?? 'vs'),
          score: meta.score ? String(meta.score) : undefined,
          result: meta.gameResult ? String(meta.gameResult) : undefined,
          league: meta.leagueName ? String(meta.leagueName) : undefined,
          stats,
        })
      }
    }
  }

  // Los últimos partidos primero (no asumo el orden del feed: ordeno por fecha desc).
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return out.slice(0, limit)
}
