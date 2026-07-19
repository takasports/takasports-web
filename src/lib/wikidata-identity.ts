// Corroboración de identidad contra homónimos de Wikidata — puro y agnóstico del fetch.
//
// El problema: buscar un jugador por NOMBRE en Wikidata y quedarse con el primer "futbolista"
// funciona para nombres únicos, pero con un mononimio como "Pedro" devuelve al primer Pedro
// futbolista de la lista (el ex-Barça Pedro Rodríguez, 1987) y le acabábamos pegando su cara
// —y su palmarés— al brasileño del Flamengo (1997). Aquí decidimos qué candidato es DE VERDAD
// la persona contrastando fecha de nacimiento, nacionalidad y club, y descartamos si no se
// puede confirmar: mejor sin dato que con el de otro.
//
// Lo consumen dos sitios con su propio fetch: la cascada de fotos (entity-images.ts) y la
// trayectoria/palmarés del perfil (player-wikidata.ts). Por eso este módulo no hace red: recibe
// claims ya traídos, y para el rescate por club se le inyecta el fetcher.

// Claims tal como los devuelve wbgetentities: cada propiedad es una lista de snaks.
export type WikiSnak = { mainsnak?: { datavalue?: { value?: unknown } } }
export type WikiClaims = Record<string, WikiSnak[] | undefined>

export interface Candidate { qid: string; claims: WikiClaims }

/** Señales de identidad (de ESPN) para corroborar el match. Todas opcionales. */
export interface IdentitySignals {
  name: string
  nationality?: string | null   // país en INGLÉS ("Brazil", "Spain")
  birthDate?: string | null     // ISO "YYYY-MM-DD"
  club?: string | null          // club actual (nombre ESPN) — ancla del rescate por club
}

// Ocupación (P106) por deporte — guardarraíl base anti-homónimos. Solo QIDs verificados contra
// la API. Un deporte sin entrada NO busca por nombre: preferimos no mostrar dato a arriesgar.
export const WIKIDATA_OCCUPATION: Record<string, string> = {
  soccer: 'Q937857',
  football: 'Q937857',
  basketball: 'Q3665646',
}

// País (nombre en INGLÉS, como lo da ESPN) → QIDs de nacionalidad aceptables en Wikidata.
// Señal SOLO POSITIVA: confirma un match, nunca lo descarta. P27 mezcla estado soberano y
// constituyente (un galés suele figurar como Reino Unido) y hay dobles nacionalidades, así que
// un "no coincide" no prueba que sea otra persona. Las naciones británicas aceptan también Q145.
export const WIKIDATA_COUNTRY_QID: Record<string, string[]> = {
  Brazil: ['Q155'], Spain: ['Q29'], France: ['Q142'], Germany: ['Q183'],
  England: ['Q21', 'Q145'], Portugal: ['Q45'], Argentina: ['Q414'], Italy: ['Q38'],
  Netherlands: ['Q55'], Belgium: ['Q31'], Croatia: ['Q224'], Uruguay: ['Q77'],
  Colombia: ['Q739'], Mexico: ['Q96'], Senegal: ['Q1041'], Morocco: ['Q1028'],
  Nigeria: ['Q1033'], 'Ivory Coast': ['Q1008'], Austria: ['Q40'], Switzerland: ['Q39'],
  Denmark: ['Q35'], Sweden: ['Q34'], Norway: ['Q20'], Poland: ['Q36'],
  Serbia: ['Q403'], Ukraine: ['Q212'], Turkey: ['Q43'], 'United States': ['Q30'],
  Japan: ['Q17'], 'South Korea': ['Q884'], Ecuador: ['Q736'], Chile: ['Q298'],
  Peru: ['Q419'], Wales: ['Q25', 'Q145'], Scotland: ['Q22', 'Q145'],
  Ireland: ['Q27'], Slovakia: ['Q214'], 'Czech Republic': ['Q213'], Hungary: ['Q28'],
  Greece: ['Q41'], Romania: ['Q218'], Cameroon: ['Q1009'], Ghana: ['Q117'],
  Egypt: ['Q79'], Algeria: ['Q262'], Tunisia: ['Q948'], Guinea: ['Q1006'],
  Gambia: ['Q1005'], Mali: ['Q912'], Gabon: ['Q1000'],
}

// P31 ("instancia de") de una entidad-club de fútbol. Filtra el nombre del club (colisiona
// con barrios/ríos/distritos) al resolver su QID para el rescate. Wikidata tipa los clubes de
// varias formas y hay que cubrirlas TODAS: el FC Barcelona NO es Q476028 sino Q103229495
// ("men's association football team") + Q20639856 ("professional sports team"), así que con un
// set estrecho Pedri/Raphinha se quedaban sin rescate. Ser permisivo aquí es seguro: el rescate
// exige después P54=<esa QID>, de modo que un tipo de más solo puede no encontrar a nadie.
export const FOOTBALL_CLUB_P31 = new Set([
  'Q476028',      // association football club
  'Q847017',      // sports club
  'Q103229495',   // men's association football team
  'Q20639856',    // professional sports team
])

/** Los valores de tipo entidad llegan como { 'entity-type': 'item', id: 'Q…' }. */
export function claimEntityIds(claims: WikiClaims | null, property: string): string[] {
  return (claims?.[property] ?? [])
    .map(claim => claim.mainsnak?.datavalue?.value)
    .map(value =>
      typeof value === 'object' && value !== null && 'id' in value
        ? String((value as { id: unknown }).id)
        : null,
    )
    .filter((id): id is string => id !== null)
}

/**
 * Fecha de nacimiento (P569) con precisión de DÍA → "YYYY-MM-DD". null si falta o es menos
 * precisa que el día: solo una fecha a nivel de día vale como señal dura de identidad.
 */
export function claimBirthDay(claims: WikiClaims | null): string | null {
  const value = claims?.P569?.[0]?.mainsnak?.datavalue?.value
  if (!value || typeof value !== 'object') return null
  const time = (value as { time?: unknown }).time
  const precision = (value as { precision?: unknown }).precision
  if (typeof time !== 'string' || typeof precision !== 'number' || precision < 11) return null
  const match = time.match(/^\+(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/** Nacionalidades del candidato: ciudadanía (P27) ∪ país que representa en el deporte (P1532). */
export function nationalityQids(claims: WikiClaims | null): Set<string> {
  return new Set([...claimEntityIds(claims, 'P27'), ...claimEntityIds(claims, 'P1532')])
}

/** QIDs de nacionalidad esperados para el país (inglés) de ESPN; vacío si no está mapeado. */
export function expectedNationalityQids(nationality?: string | null): Set<string> {
  return new Set((nationality && WIKIDATA_COUNTRY_QID[nationality]) || [])
}

function isMononym(name: string): boolean {
  return name.trim().split(/\s+/).length === 1
}

/**
 * Elige, entre los homónimos de una búsqueda por nombre, al futbolista que DE VERDAD es la
 * persona — o a ninguno. Reglas, de la señal más fuerte a la más débil:
 *   1. Descarta a quien CHOQUE en fecha de nacimiento (fechas a nivel de día que no coinciden
 *      ⇒ es otra persona). Señal dura.
 *   2. Si alguien CORROBORA (misma fecha de nacimiento, o nacionalidad esperada) gana; la
 *      fecha manda sobre la nacionalidad.
 *   3. Si nadie corrobora pero el nombre NO es un mononimio y queda un único futbolista sin
 *      conflicto, se acepta: nombre inequívoco, riesgo bajo.
 *   4. En cualquier otro caso (mononimio, o varios indistinguibles) → null. El llamador aún
 *      puede intentar el rescate por club.
 */
export function selectCorroboratedCandidate(
  signals: IdentitySignals,
  occupation: string,
  candidates: Candidate[],
): Candidate | null {
  const footballers = candidates.filter(c => claimEntityIds(c.claims, 'P106').includes(occupation))
  if (!footballers.length) return null

  const expectedNats = expectedNationalityQids(signals.nationality)
  const scored = footballers.map(c => {
    const day = claimBirthDay(c.claims)
    const nats = nationalityQids(c.claims)
    return {
      candidate: c,
      dobMatch: Boolean(signals.birthDate && day && day === signals.birthDate),
      dobConflict: Boolean(signals.birthDate && day && day !== signals.birthDate),
      natMatch: expectedNats.size > 0 && [...nats].some(n => expectedNats.has(n)),
    }
  })

  const viable = scored.filter(s => !s.dobConflict)
  const positive = viable.filter(s => s.dobMatch || s.natMatch)
  if (positive.length) {
    positive.sort((a, b) => Number(b.dobMatch) - Number(a.dobMatch))   // fecha antes que nacionalidad
    return positive[0].candidate
  }

  if (!isMononym(signals.name) && footballers.length === 1 && viable.length === 1) {
    return viable[0].candidate
  }
  return null
}

// Fetcher inyectable para el rescate: debe devolver el JSON parseado o LANZAR si falla (no
// devolver null), para que un fallo transitorio se propague y no se confunda con "no existe".
export type WikiFetch = <T>(url: string) => Promise<T>

/**
 * QID del club por nombre, quedándose con la primera entidad que ES un club de fútbol (P31).
 */
async function resolveClubQid(clubName: string, fetchJson: WikiFetch): Promise<string | null> {
  const search = await fetchJson<{ search?: Array<{ id?: string }> }>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      clubName,
    )}&language=es&uselang=es&type=item&limit=5&format=json&origin=*`,
  )
  const ids = (search?.search ?? []).map(hit => hit.id).filter((id): id is string => Boolean(id))
  if (!ids.length) return null

  const entities = await fetchJson<{ entities?: Record<string, { claims?: WikiClaims }> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join(
      '|',
    )}&props=claims&format=json&origin=*`,
  )
  for (const id of ids) {
    const p31 = claimEntityIds(entities?.entities?.[id]?.claims ?? null, 'P31')
    if (p31.some(q => FOOTBALL_CLUB_P31.has(q))) return id
  }
  return null
}

/**
 * Último recurso cuando la búsqueda por nombre no confirmó a nadie: la lista de homónimos de un
 * mononimio ("Pedro") ni siquiera contiene al jugador real. Aquí anclamos por el CLUB
 * —`P54=<club>`, que es casi único— y corroboramos la fecha de nacimiento. Así Pedro (del
 * Flamengo) recupera SU identidad. Necesita club: sin él no hay ancla.
 */
export async function rescueCandidateByClub(
  signals: IdentitySignals,
  occupation: string,
  fetchJson: WikiFetch,
): Promise<Candidate | null> {
  if (!signals.club) return null
  const clubQid = await resolveClubQid(signals.club, fetchJson)
  if (!clubQid) return null

  const search = await fetchJson<{ query?: { search?: Array<{ title?: string }> } }>(
    `https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      `${signals.name} haswbstatement:P106=${occupation} haswbstatement:P54=${clubQid}`,
    )}&srlimit=10&format=json&origin=*`,
  )
  const ids = (search?.query?.search ?? []).map(hit => hit.title).filter((t): t is string => Boolean(t))
  if (!ids.length) return null

  const entities = await fetchJson<{ entities?: Record<string, { claims?: WikiClaims }> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join(
      '|',
    )}&props=claims&format=json&origin=*`,
  )
  // Todos comparten club y ocupación; solo hay que descartar choque de fecha y priorizar su
  // coincidencia. Si la fecha no está, el club ya basta como ancla.
  const scored = ids
    .map(id => ({ qid: id, claims: entities?.entities?.[id]?.claims ?? null }))
    .filter((c): c is Candidate => c.claims !== null)
    .map(c => {
      const day = claimBirthDay(c.claims)
      return {
        candidate: c,
        dobMatch: Boolean(signals.birthDate && day && day === signals.birthDate),
        dobConflict: Boolean(signals.birthDate && day && day !== signals.birthDate),
      }
    })
  const viable = scored.filter(s => !s.dobConflict)
  if (!viable.length) return null
  viable.sort((a, b) => Number(b.dobMatch) - Number(a.dobMatch))
  return viable[0].candidate
}
