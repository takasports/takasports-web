// Trayectoria de clubes y distinciones individuales de un jugador, desde Wikidata.
//
// Se busca por NOMBRE y se CORROBORA la identidad (nacionalidad / club / fecha de nacimiento)
// con la MISMA lógica que la cascada de fotos (wikidata-identity.ts), para no traer homónimos:
// un mononimio como "Pedro" devolvía la trayectoria del ex-Barça y la pegaba al del Flamengo.
// Cacheado por el revalidate de la ruta de perfil; Wikidata tolera bien este volumen.
// Honestidad de datos:
//   - Trayectoria: P54 mezcla selecciones y filiales → se filtran por patrón de nombre.
//   - Distinciones: P166 son premios INDIVIDUALES (Golden Boy, Bota de Oro, Jugador del
//     Mes…). Los TÍTULOS de equipo no viven aquí de forma fiable → esos se difieren a
//     api-football. Por eso el campo se llama "honors" (distinciones), no "trofeos".

import {
  WIKIDATA_OCCUPATION,
  rescueCandidateByClub,
  selectCorroboratedCandidate,
  type Candidate,
  type IdentitySignals,
  type WikiClaims,
} from '@/lib/wikidata-identity'

const WIKI_HEADERS = { 'User-Agent': 'TakaSports/1.0 (+https://www.takasportsmedia.com)' }
const WIKI_TIMEOUT_MS = 12_000

// Selecciones (sub-XX / absoluta), filiales (" II", " B", reserve) y juveniles: fuera de
// la trayectoria de clubes sénior. Robusto en es/en para este dominio.
const NON_SENIOR_CLUB = /selecci[oó]n|national team|\bnational\b|\bsub-?\d|\bU-?\d{2}\b|reserve|juvenil|\sII$|\sB$/i

// P166 en atletas no-futbolistas mezcla ruido no deportivo (premios de cine, ciudadanía)
// y artefactos de listas de Wikipedia ("Anexo:"/"List of"). Ej. real: LeBron sale con un
// "Anexo:Razzie al peor actor". Se filtran para no ensuciar el perfil con premios ajenos.
const NON_SPORT_HONOR = /^(anexo:|list of|lista de)|razzie|actor|actriz|ciudadan|citizen/i

export interface CareerStint { club: string; from: string | null; to: string | null }
export interface Honor { title: string; year: string | null }
export interface PlayerWikidata { qid: string; career: CareerStint[]; honors: Honor[] }

interface Snak { mainsnak?: { datavalue?: { value?: unknown } }; qualifiers?: Record<string, Array<{ datavalue?: { value?: unknown } }>> }

async function wget(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: WIKI_HEADERS,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(WIKI_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

function snakId(snak: Snak | undefined): string | null {
  const v = snak?.mainsnak?.datavalue?.value
  return v && typeof v === 'object' && 'id' in v ? String((v as { id: unknown }).id) : null
}

function qualYear(snak: Snak, pid: string): string | null {
  const v = snak.qualifiers?.[pid]?.[0]?.datavalue?.value
  const time = v && typeof v === 'object' && 'time' in v ? String((v as { time: unknown }).time) : ''
  return time ? time.slice(1, 5) : null   // "+2018-00-00..." → "2018"
}

async function resolveLabels(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {}
  const data = await wget(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join(
      '|',
    )}&props=labels&languages=es%7Cen&format=json&origin=*`,
  )
  const entities = (data?.entities ?? {}) as Record<string, { labels?: Record<string, { value?: string }> }>
  const out: Record<string, string> = {}
  for (const [id, ent] of Object.entries(entities)) {
    const label = ent.labels?.es?.value ?? ent.labels?.en?.value
    if (label) out[id] = label
  }
  return out
}

/** Une tramos consecutivos del mismo club (Wikidata suele partir un fichaje en varias). */
function mergeStints(stints: CareerStint[]): CareerStint[] {
  const sorted = [...stints].sort((a, b) => (a.from ?? '').localeCompare(b.from ?? ''))
  const merged: CareerStint[] = []
  for (const s of sorted) {
    const prev = merged[merged.length - 1]
    if (prev && prev.club === s.club) {
      prev.to = s.to === null || (prev.to !== null && s.to > prev.to) ? s.to : prev.to
    } else {
      merged.push({ ...s })
    }
  }
  return merged.reverse()   // más reciente primero
}

// wget devuelve null ante un fallo; el rescate compartido exige un fetcher que LANCE (para no
// confundir "falló la red" con "no existe"). Este wrapper adapta uno al otro.
async function throwingWget<T>(url: string): Promise<T> {
  const data = await wget(url)
  if (data === null) throw new Error('wiki fetch failed')
  return data as T
}

export async function fetchPlayerWikidata(
  signals: IdentitySignals,
  sport: string,
): Promise<PlayerWikidata | null> {
  const occupation = WIKIDATA_OCCUPATION[sport]
  if (!occupation) return null   // deporte sin guardarraíl verificado → no arriesgar homónimos

  const search = await wget(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      signals.name,
    )}&language=es&uselang=es&type=item&limit=5&format=json&origin=*`,
  )
  const hits = (search?.search ?? []) as Array<{ id?: string }>
  const ids = hits.map(h => h.id).filter((id): id is string => Boolean(id))

  const ent = ids.length
    ? await wget(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=claims&format=json&origin=*`,
      )
    : null
  const entities = (ent?.entities ?? {}) as Record<string, { claims?: WikiClaims }>
  const candidates: Candidate[] = ids
    .map(id => ({ qid: id, claims: entities[id]?.claims ?? null }))
    .filter((c): c is Candidate => c.claims !== null)

  // Misma corroboración que la foto: nacionalidad / fecha de nacimiento y, si por nombre no se
  // confirma a nadie, rescate anclado en el club. Sin match → sin trayectoria (mejor que la de otro).
  let chosen = selectCorroboratedCandidate(signals, occupation, candidates)
  if (!chosen) {
    try { chosen = await rescueCandidateByClub(signals, occupation, throwingWget) }
    catch { chosen = null }
  }
  if (!chosen) return null

  const qid = chosen.qid
  const claims = (chosen.claims ?? {}) as unknown as Record<string, Snak[]>
  const p54 = claims.P54 ?? []
  const p166 = claims.P166 ?? []

  const refs = [...new Set([...p54, ...p166].map(snakId).filter((v): v is string => Boolean(v)))]
  const labels = await resolveLabels(refs)

  const stints: CareerStint[] = []
  for (const c of p54) {
    const id = snakId(c)
    if (!id) continue
    const club = labels[id] ?? id
    if (NON_SENIOR_CLUB.test(club)) continue
    stints.push({ club, from: qualYear(c, 'P580'), to: qualYear(c, 'P582') })
  }

  const honorsRaw: Honor[] = []
  const seen = new Set<string>()
  for (const h of p166) {
    const id = snakId(h)
    if (!id) continue
    const title = labels[id] ?? id
    if (NON_SPORT_HONOR.test(title)) continue
    const year = qualYear(h, 'P585')
    const key = `${title}|${year ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    honorsRaw.push({ title, year })
  }
  honorsRaw.sort((a, b) => (b.year ?? '').localeCompare(a.year ?? ''))

  return { qid, career: mergeStints(stints), honors: honorsRaw }
}
