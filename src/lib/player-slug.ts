// Slugs de las fichas de jugador: del ID opaco a una URL con el nombre dentro.
//
// Antes:  /jugador/soccer_esp.1_231388   → sin keyword, ilegible en el SERP
// Ahora:  /jugador/kylian-mbappe-231388  → misma resolución, keyword en la URL
//
// Por qué el ID sigue al final y no un slug de solo nombre:
//   1. Sin colisiones. Los mononimios brasileños/portugueses chocan de verdad —
//      "João Pedro" son 7 jugadores distintos en la base, "Vitinha" son 2 de los
//      que ya están indexados (PSG y Genoa). Un slug de solo nombre obligaría a
//      desambiguar contra la BD en cada enlace que se pinta.
//   2. Resolución determinista. El ID se lee de la propia URL, sin consultar nada.
//   3. Los enlaces internos se construyen sin ir a la BD: cada listado ya tiene el
//      nombre y el id a mano.
//   4. El nombre es decorativo. Si cambia la grafía ("Mbappé" → "Mbappe"), el ID
//      manda y la URL vieja sigue resolviendo; la página la redirige a la nueva.
//
// COMPATIBILIDAD CON LA APP — no retirar el formato legacy:
// la app móvil (v1.0.2, ya publicada) CONSTRUYE el slug "<sport>_<league>_<id>" por
// concatenación en varias pantallas y lo guarda como identidad de los equipos
// seguidos, en AsyncStorage y sincronizado a Supabase. Mientras haya instalaciones
// de esa versión, `/api/jugador/[slug]` DEBE seguir aceptando el formato compuesto.
// Es una entrada permanente, no una fase de transición.

import { adminSupabase } from '@/lib/supabase-admin'

/** Referencia resuelta de un jugador, sea cual sea el formato de entrada. */
export interface PlayerRef {
  /** ID de ESPN — lo único que identifica de verdad al jugador. */
  espnId: string
  /** "soccer/esp.1" — necesario para pedir el overview a ESPN. */
  leagueSlug: string
}

// Letras que NO se descomponen con NFD (su diacrítico no es un carácter combinante,
// forma parte del glifo). Sin esto, media Europa del Este pierde la última letra:
// "Mitrović" → "mitrovi", "Vlahović" → "vlahovi".
const NON_DECOMPOSABLE: Record<string, string> = {
  đ: 'd', Đ: 'D', ð: 'd', Ð: 'D',
  ø: 'o', Ø: 'O', ł: 'l', Ł: 'L',
  ß: 'ss', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE',
  ı: 'i', ħ: 'h', ŧ: 't',
}

/**
 * Nombre → parte legible del slug. Sin acentos, sin signos y sin guiones bajos:
 * ese "_" es justo lo que distingue un slug legacy de uno nuevo, así que no puede
 * aparecer nunca en la parte del nombre.
 *
 * NFD separa cada letra de su diacrítico y luego se tiran los combinantes, así que
 * cubre de una vez ć/č/š/ž/é/ñ/ü… sin mantener una tabla a mano. Solo hay que tratar
 * aparte las letras del mapa de arriba, que NFD no descompone.
 */
export function toNameSlug(name: string): string {
  let out = ''
  for (const ch of name) out += NON_DECOMPOSABLE[ch] ?? ch
  return out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // marcas diacríticas combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Slug canónico de una ficha. Si el nombre se queda en nada al normalizar (nombres
 * en alfabetos no latinos, por ejemplo), cae a solo el id: sigue siendo una URL
 * válida y resoluble, simplemente sin keyword.
 */
export function canonicalPlayerSlug(name: string | null | undefined, espnId: string): string {
  const base = name ? toNameSlug(name) : ''
  return base ? `${base}-${espnId}` : espnId
}

/**
 * Formato antiguo "<sport>_<league>_<id>". Se reconoce por el "_", que el formato
 * nuevo no puede contener.
 */
export function isLegacyPlayerSlug(slug: string): boolean {
  return slug.includes('_')
}

/** "soccer_esp.1_231388" → { espnId: "231388", leagueSlug: "soccer/esp.1" } */
export function parseLegacyPlayerSlug(slug: string): PlayerRef | null {
  const parts = slug.split('_')
  if (parts.length < 3) return null
  const espnId = parts[parts.length - 1]
  if (!/^\d+$/.test(espnId)) return null
  return { espnId, leagueSlug: parts.slice(0, -1).join('/') }
}

/** "kylian-mbappe-231388" → "231388". También acepta un id pelado. */
export function extractEspnId(slug: string): string | null {
  const m = /(?:^|-)(\d+)$/.exec(slug)
  return m ? m[1] : null
}

/**
 * Liga de un jugador a partir de su id de ESPN, leída de sport_entities (el mismo
 * hub que puebla el cron de fotos: 18.5k jugadores, todos con espn_id y leagueSlug).
 * Devuelve también el nombre para poder redirigir al slug canónico.
 */
export async function lookupPlayerByEspnId(
  espnId: string,
): Promise<{ name: string; leagueSlug: string } | null> {
  const db = adminSupabase()
  if (!db) return null
  const { data, error } = await db
    .from('sport_entities')
    .select('name, meta')
    .eq('type', 'player')
    .eq('espn_id', espnId)
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const leagueSlug = (data.meta as { leagueSlug?: string } | null)?.leagueSlug
  if (!leagueSlug) return null
  return { name: data.name as string, leagueSlug }
}

/**
 * Resuelve cualquiera de los dos formatos a { espnId, leagueSlug }.
 * El legacy se resuelve sin tocar la BD (la liga viene en la propia URL), así que
 * las peticiones de la app instalada no pagan ninguna consulta extra.
 */
export async function resolvePlayerSlug(slug: string): Promise<PlayerRef | null> {
  if (isLegacyPlayerSlug(slug)) return parseLegacyPlayerSlug(slug)

  const espnId = extractEspnId(slug)
  if (!espnId) return null
  const found = await lookupPlayerByEspnId(espnId)
  return found ? { espnId, leagueSlug: found.leagueSlug } : null
}
