import { describe, it, expect } from 'vitest'
import { countryFromTimeZone, COUNTRY_TZ, COUNTRY_NAMES, COUNTRY_FLAGS } from './broadcast-countries'

describe('countryFromTimeZone', () => {
  it('resuelve las zonas de los nueve países de la primera tanda', () => {
    expect(countryFromTimeZone('Europe/Madrid')).toBe('ES')
    expect(countryFromTimeZone('America/Mexico_City')).toBe('MX')
    expect(countryFromTimeZone('America/Lima')).toBe('PE')
    expect(countryFromTimeZone('America/Bogota')).toBe('CO')
    expect(countryFromTimeZone('America/Santiago')).toBe('CL')
    expect(countryFromTimeZone('America/Caracas')).toBe('VE')
    expect(countryFromTimeZone('America/Guayaquil')).toBe('EC')
    expect(countryFromTimeZone('America/New_York')).toBe('US')
  })

  it('cubre las variantes provinciales de Argentina, que no están en el mapa literal', () => {
    expect(countryFromTimeZone('America/Argentina/Buenos_Aires')).toBe('AR')
    expect(countryFromTimeZone('America/Argentina/Cordoba')).toBe('AR')
    expect(countryFromTimeZone('America/Argentina/Ushuaia')).toBe('AR')
  })

  it('trata Canarias como España y los husos de EE.UU. como US', () => {
    expect(countryFromTimeZone('Atlantic/Canary')).toBe('ES')
    expect(countryFromTimeZone('America/Los_Angeles')).toBe('US')
    expect(countryFromTimeZone('America/Indiana/Indianapolis')).toBe('US')
  })

  it('devuelve null si no conoce la zona, para que no se resalte ninguna fila', () => {
    expect(countryFromTimeZone('Asia/Tokyo')).toBeNull()
    expect(countryFromTimeZone('')).toBeNull()
    expect(countryFromTimeZone(null)).toBeNull()
    expect(countryFromTimeZone(undefined)).toBeNull()
  })
})

describe('tablas de países', () => {
  it('todo país con zona tiene nombre y bandera', () => {
    for (const code of Object.keys(COUNTRY_TZ)) {
      expect(COUNTRY_NAMES[code], `falta el nombre de ${code}`).toBeTruthy()
      expect(COUNTRY_FLAGS[code], `falta la bandera de ${code}`).toBeTruthy()
    }
  })

  it('la zona representativa de cada país resuelve a ese mismo país', () => {
    for (const [code, tz] of Object.entries(COUNTRY_TZ)) {
      expect(countryFromTimeZone(tz), `${tz} debería resolver a ${code}`).toBe(code)
    }
  })

  it('las zonas son IANA válidas', () => {
    for (const tz of Object.values(COUNTRY_TZ)) {
      expect(() => new Intl.DateTimeFormat('es-ES', { timeZone: tz })).not.toThrow()
    }
  })
})
