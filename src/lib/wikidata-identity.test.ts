import { describe, it, expect } from 'vitest'
import {
  selectCorroboratedCandidate,
  rescueCandidateByClub,
  type Candidate,
  type WikiClaims,
} from './wikidata-identity'

const FOOTBALLER = 'Q937857'

// Constructor de claims al estilo wbgetentities para los tests.
function claims(opts: {
  occupation?: string
  birthDay?: string   // "YYYY-MM-DD"
  nationality?: string[]  // QIDs
  clubs?: string[]        // QIDs (P54)
  p31?: string[]          // instancia de (para clubs)
  photo?: string          // P18
}): WikiClaims {
  const c: WikiClaims = {}
  if (opts.occupation) c.P106 = [{ mainsnak: { datavalue: { value: { id: opts.occupation } } } }]
  if (opts.birthDay)
    c.P569 = [{ mainsnak: { datavalue: { value: { time: `+${opts.birthDay}T00:00:00Z`, precision: 11 } } } }]
  if (opts.nationality) c.P27 = opts.nationality.map(id => ({ mainsnak: { datavalue: { value: { id } } } }))
  if (opts.clubs) c.P54 = opts.clubs.map(id => ({ mainsnak: { datavalue: { value: { id } } } }))
  if (opts.p31) c.P31 = opts.p31.map(id => ({ mainsnak: { datavalue: { value: { id } } } }))
  if (opts.photo) c.P18 = [{ mainsnak: { datavalue: { value: opts.photo } } }]
  return c
}

// Los dos "Pedro": el brasileño del Flamengo (1997) y el ex-Barça (1987).
const PEDRO_GUILHERME: Candidate = {
  qid: 'Q47491410',
  claims: claims({ occupation: FOOTBALLER, birthDay: '1997-06-20', nationality: ['Q155'], photo: 'guilherme.jpg' }),
}
const PEDRO_RODRIGUEZ: Candidate = {
  qid: 'Q179773',
  claims: claims({ occupation: FOOTBALLER, birthDay: '1987-07-28', nationality: ['Q29'], photo: 'rodriguez.jpg' }),
}

describe('selectCorroboratedCandidate', () => {
  it('descarta al homónimo que CHOCA en fecha de nacimiento (el bug de Pedro)', () => {
    const chosen = selectCorroboratedCandidate(
      { name: 'Pedro', nationality: 'Brazil', birthDate: '1997-06-20' },
      FOOTBALLER,
      [PEDRO_RODRIGUEZ, PEDRO_GUILHERME],
    )
    expect(chosen?.qid).toBe('Q47491410')
  })

  it('con SOLO el candidato equivocado y fecha en conflicto → null (nunca la cara de otro)', () => {
    const chosen = selectCorroboratedCandidate(
      { name: 'Pedro', nationality: 'Brazil', birthDate: '1997-06-20' },
      FOOTBALLER,
      [PEDRO_RODRIGUEZ],
    )
    expect(chosen).toBeNull()
  })

  it('mononimio sin señal que corrobore y candidato único → null (no se arriesga)', () => {
    const chosen = selectCorroboratedCandidate(
      { name: 'Pedro' },   // sin nacionalidad ni fecha
      FOOTBALLER,
      [PEDRO_RODRIGUEZ],
    )
    expect(chosen).toBeNull()
  })

  it('corrobora por NACIONALIDAD cuando no hay fecha', () => {
    const chosen = selectCorroboratedCandidate(
      { name: 'Pedro', nationality: 'Brazil' },
      FOOTBALLER,
      [PEDRO_RODRIGUEZ, PEDRO_GUILHERME],
    )
    expect(chosen?.qid).toBe('Q47491410')
  })

  it('la coincidencia de FECHA manda sobre la de nacionalidad', () => {
    // Un candidato casa por nacionalidad; otro por fecha exacta → gana la fecha.
    const byNat: Candidate = { qid: 'Q_NAT', claims: claims({ occupation: FOOTBALLER, nationality: ['Q155'] }) }
    const byDob: Candidate = { qid: 'Q_DOB', claims: claims({ occupation: FOOTBALLER, birthDay: '1997-06-20', nationality: ['Q30'] }) }
    const chosen = selectCorroboratedCandidate(
      { name: 'Pedro', nationality: 'Brazil', birthDate: '1997-06-20' },
      FOOTBALLER,
      [byNat, byDob],
    )
    expect(chosen?.qid).toBe('Q_DOB')
  })

  it('nombre NO mononimio con un único futbolista y sin señales → se acepta (Lewandowski)', () => {
    const lewa: Candidate = { qid: 'Q151269', claims: claims({ occupation: FOOTBALLER }) }
    const noise: Candidate = { qid: 'Q_X', claims: claims({}) }   // sin ocupación futbolista
    const chosen = selectCorroboratedCandidate(
      { name: 'Robert Lewandowski' },
      FOOTBALLER,
      [lewa, noise],
    )
    expect(chosen?.qid).toBe('Q151269')
  })

  it('sin ningún futbolista entre los candidatos → null', () => {
    const chosen = selectCorroboratedCandidate({ name: 'Pedro' }, FOOTBALLER, [
      { qid: 'Q_A', claims: claims({}) },
    ])
    expect(chosen).toBeNull()
  })

  it('la nacionalidad NO descarta (un inglés puede figurar como Reino Unido)', () => {
    // Candidato único inglés cuyo P27 es Reino Unido (Q145); ESPN dice "England".
    const uk: Candidate = { qid: 'Q_UK', claims: claims({ occupation: FOOTBALLER, nationality: ['Q145'] }) }
    const chosen = selectCorroboratedCandidate(
      { name: 'Harry Kane', nationality: 'England' },
      FOOTBALLER,
      [uk],
    )
    expect(chosen?.qid).toBe('Q_UK')   // positivo por Q145; y aunque no casara, no se descarta
  })
})

describe('rescueCandidateByClub', () => {
  // Fetch simulado: enruta por la forma de la URL a respuestas canónicas.
  function fakeFetch(routes: Record<string, unknown>) {
    return async <T,>(url: string): Promise<T> => {
      if (url.includes('wbsearchentities')) return routes.clubSearch as T
      if (url.includes('list=search')) return routes.playerSearch as T
      if (url.includes('wbgetentities')) {
        // Dos wbgetentities: el del club (tras clubSearch) y el de jugadores (tras playerSearch).
        return (url.includes('Q17479') || url.includes('Q995561') ? routes.clubEntities : routes.playerEntities) as T
      }
      throw new Error(`unexpected url ${url}`)
    }
  }

  it('recupera a Pedro Guilherme anclando por el club Flamengo y casando la fecha', async () => {
    const fetchJson = fakeFetch({
      clubSearch: { search: [{ id: 'Q995561' }, { id: 'Q17479' }] },   // barrio primero, club después
      clubEntities: {
        entities: {
          Q995561: { claims: claims({ p31: ['Q20683285'] }) },        // barrio → descartado
          Q17479: { claims: claims({ p31: ['Q847017', 'Q476028'] }) }, // club de fútbol → elegido
        },
      },
      playerSearch: { query: { search: [{ title: 'Q47491410' }, { title: 'Q_OLD_PEDRO' }] } },
      playerEntities: {
        entities: {
          Q47491410: { claims: claims({ occupation: FOOTBALLER, birthDay: '1997-06-20', photo: 'g.jpg' }) },
          Q_OLD_PEDRO: { claims: claims({ occupation: FOOTBALLER, birthDay: '1960-01-01' }) },
        },
      },
    })
    const chosen = await rescueCandidateByClub(
      { name: 'Pedro', club: 'Flamengo', birthDate: '1997-06-20' },
      FOOTBALLER,
      fetchJson,
    )
    expect(chosen?.qid).toBe('Q47491410')
  })

  it('sin club no hay ancla → null', async () => {
    const chosen = await rescueCandidateByClub({ name: 'Pedro' }, FOOTBALLER, async () => {
      throw new Error('no debería llamarse')
    })
    expect(chosen).toBeNull()
  })

  it('si el candidato del club CHOCA en fecha, no lo acepta → null', async () => {
    const fetchJson = fakeFetch({
      clubSearch: { search: [{ id: 'Q17479' }] },
      clubEntities: { entities: { Q17479: { claims: claims({ p31: ['Q476028'] }) } } },
      playerSearch: { query: { search: [{ title: 'Q_WRONG' }] } },
      playerEntities: { entities: { Q_WRONG: { claims: claims({ occupation: FOOTBALLER, birthDay: '1980-01-01' }) } } },
    })
    const chosen = await rescueCandidateByClub(
      { name: 'Pedro', club: 'Flamengo', birthDate: '1997-06-20' },
      FOOTBALLER,
      fetchJson,
    )
    expect(chosen).toBeNull()
  })
})
