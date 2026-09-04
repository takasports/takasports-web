import { describe, it, expect } from 'vitest'
import { compDeCasa, empujonRegional, EMPUJON_REGIONAL } from './region-visitante'
import { getEventHighlightScore } from './competitions'

describe('compDeCasa', () => {
  it('reconoce México en sus varios husos', () => {
    for (const tz of ['America/Mexico_City', 'America/Tijuana', 'America/Monterrey', 'America/Cancun']) {
      expect(compDeCasa(tz)).toBe('Liga MX')
    }
  })

  it('reconoce Brasil y Argentina', () => {
    expect(compDeCasa('America/Sao_Paulo')).toBe('Brasileirão')
    expect(compDeCasa('America/Fortaleza')).toBe('Brasileirão')
    expect(compDeCasa('America/Argentina/Buenos_Aires')).toBe('Liga Argentina')
  })

  it('Estados Unidos y Canadá van a MLS', () => {
    expect(compDeCasa('America/New_York')).toBe('MLS')
    expect(compDeCasa('America/Toronto')).toBe('MLS')
  })

  it('España y Europa NO cambian nada: devuelven null', () => {
    // Es deliberado: el orden que ya existe es el suyo.
    for (const tz of ['Europe/Madrid', 'Europe/London', 'Europe/Berlin', 'Atlantic/Canary']) {
      expect(compDeCasa(tz)).toBeNull()
    }
  })

  it('sin huso, o con uno desconocido, no hay región', () => {
    expect(compDeCasa(null)).toBeNull()
    expect(compDeCasa(undefined)).toBeNull()
    expect(compDeCasa('')).toBeNull()
    expect(compDeCasa('Asia/Tokyo')).toBeNull()
  })
})

describe('empujonRegional', () => {
  it('empuja SOLO la competición de tu país', () => {
    expect(empujonRegional('Liga MX', 'America/Mexico_City')).toBe(EMPUJON_REGIONAL)
    expect(empujonRegional('LaLiga', 'America/Mexico_City')).toBe(0)
    expect(empujonRegional('Brasileirão', 'America/Mexico_City')).toBe(0)
  })

  it('a quien mira desde Madrid no le cambia nada', () => {
    for (const comp of ['LaLiga', 'Liga MX', 'Brasileirão', 'Champions']) {
      expect(empujonRegional(comp, 'Europe/Madrid')).toBe(0)
    }
  })

  it('no se rompe sin datos', () => {
    expect(empujonRegional(null, 'America/Mexico_City')).toBe(0)
    expect(empujonRegional('Liga MX', null)).toBe(0)
    expect(empujonRegional(undefined, undefined)).toBe(0)
  })

  it('+6 no basta para tapar a un grande europeo', () => {
    // LaLiga base 12 y Liga MX base 7: con el empujón queda en 13 contra 12,
    // pero un clásico suma pareja y rivalidad (~14,5) y sigue ganando. Este
    // test fija la INTENCIÓN: el empujón entra por debajo, no por encima.
    expect(7 + EMPUJON_REGIONAL).toBeLessThan(14)
  })
})

// ── El efecto real sobre el orden de los Destacados ──────────────────────────
// Estos tests son los que de verdad protegen el cambio: fijan QUÉ ve cada uno,
// no solo cuánto suma la función.
describe('el orden de los Destacados por región', () => {
  const puntos = (comp: string, tz: string | null, extra: Parameters<typeof getEventHighlightScore>[0] = { comp }) =>
    getEventHighlightScore({ ...extra, comp, tz }) + empujonRegional(comp, tz)

  const MX = 'America/Mexico_City'
  const ES = 'Europe/Madrid'

  it('para un mexicano, su liga adelanta a una liga media europea', () => {
    // Eredivisie/Primeira (6) contra Liga MX (7): sin empujón ya gana la MX por
    // poco; con él, sin discusión. El caso interesante es contra la Premier.
    expect(puntos('Liga MX', MX)).toBeGreaterThan(puntos('Premier', MX))
  })

  it('para un español NO cambia nada: la Premier sigue por delante', () => {
    expect(puntos('Premier', ES)).toBeGreaterThan(puntos('Liga MX', ES))
  })

  it('el empujón NO tapa a un grande europeo con cartelazo', () => {
    // Un clásico suma pareja y rivalidad por encima de la base de LaLiga.
    const clasico = puntos('LaLiga', MX, { comp: 'LaLiga', home: 'Real Madrid', away: 'Barcelona' })
    expect(clasico).toBeGreaterThan(puntos('Liga MX', MX))
  })

  it('un brasileño ve su liga por delante, un mexicano no', () => {
    const BR = 'America/Sao_Paulo'
    expect(puntos('Brasileirão', BR)).toBeGreaterThan(puntos('Brasileirão', MX))
    expect(puntos('Brasileirão', MX)).toBe(puntos('Brasileirão', ES))
  })
})
