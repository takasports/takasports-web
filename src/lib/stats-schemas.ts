// Runtime schemas for upstream stat APIs. Zod-validated at the parse boundary.
// We only validate the SHAPE of the fields we read; we don't try to be exhaustive.
// If ESPN/Jolpica add new fields, that's fine. If they remove a field we depend
// on or change its type, validation fails and the fetcher falls back to its
// stale cache (or empty array) instead of throwing later in `.map()`.

import { z } from 'zod'

// ── ESPN football standings ──────────────────────────────────────────────────
const espnTeam = z.object({
  id: z.string().optional(),
  displayName: z.string().optional(),
  abbreviation: z.string().optional(),
}).passthrough()

const rawStat = z.object({
  name: z.string(),
  value: z.number().optional(),
  displayValue: z.string().optional(),
}).passthrough()

const espnEntry = z.object({
  team: espnTeam.optional(),
  stats: z.array(rawStat).optional(),
}).passthrough()

export const espnStandingsSchema = z.object({
  children: z.array(z.object({
    standings: z.object({
      entries: z.array(espnEntry),
    }).optional(),
  }).passthrough()).optional(),
}).passthrough()

// ── Jolpica F1 driver standings ──────────────────────────────────────────────
export const jolpicaDriverStandingsSchema = z.object({
  MRData: z.object({
    StandingsTable: z.object({
      StandingsLists: z.array(z.object({
        season: z.string().optional(),
        round: z.string().optional(),
        DriverStandings: z.array(z.object({
          position: z.string().optional(),
          points: z.string().optional(),
          wins: z.string().optional(),
          Driver: z.object({
            givenName: z.string(),
            familyName: z.string(),
            nationality: z.string().optional(),
            code: z.string().optional(),
          }).passthrough(),
          Constructors: z.array(z.object({
            name: z.string(),
            constructorId: z.string().optional(),
          }).passthrough()).optional(),
        }).passthrough()).optional(),
      }).passthrough()).optional(),
    }).optional(),
  }).optional(),
}).passthrough()

/**
 * Safe-parse helper. Returns the typed value or `null` if the shape doesn't
 * match. Logs a one-line warning so schema drift is visible in dev.
 */
export function safeParse<T>(schema: z.ZodSchema<T>, value: unknown, label: string): T | null {
  const r = schema.safeParse(value)
  if (r.success) return r.data
  if (process.env.NODE_ENV !== 'production') {
    const issue = r.error.issues[0]
    console.warn(`[stats-schemas] ${label} drift: ${issue?.path.join('.')} — ${issue?.message}`)
  }
  return null
}
