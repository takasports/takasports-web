import { describe, expect, it } from 'vitest'
import { elegirIdioma, esRastreador, idiomaDePais, mapaHreflang, textosFicha } from './idiomas'

describe('idiomaDePais', () => {
  it('reconoce países de habla inglesa e hispana', () => {
    expect(idiomaDePais('US')).toBe('en')
    expect(idiomaDePais('gb')).toBe('en')
    expect(idiomaDePais('MX')).toBe('es')
    expect(idiomaDePais('ES')).toBe('es')
  })
  it('no fuerza nada para países sin versión o sin dato', () => {
    expect(idiomaDePais('JP')).toBeNull()
    expect(idiomaDePais('')).toBeNull()
    expect(idiomaDePais(null)).toBeNull()
  })
})

describe('elegirIdioma', () => {
  const base = { actual: 'es', disponibles: ['es', 'en'] }

  it('la elección guardada manda sobre todo lo demás', () => {
    expect(elegirIdioma({ ...base, guardado: 'es', navegador: ['en-US'], pais: 'US' }))
      .toEqual({ lang: 'es', motivo: 'guardado' })
  })
  it('ignora una elección guardada que ya no existe', () => {
    expect(elegirIdioma({ ...base, guardado: 'fr', navegador: ['en-GB'] }))
      .toEqual({ lang: 'en', motivo: 'navegador' })
  })
  it('usa el idioma del navegador, respetando su orden y saltando los que no existen', () => {
    expect(elegirIdioma({ ...base, navegador: ['fr-FR', 'en-US', 'es-ES'] }))
      .toEqual({ lang: 'en', motivo: 'navegador' })
  })
  it('si el navegador no dice nada útil, cae al idioma del país', () => {
    expect(elegirIdioma({ ...base, navegador: ['fr-FR'], pais: 'US' }))
      .toEqual({ lang: 'en', motivo: 'pais' })
    expect(elegirIdioma({ actual: 'en', disponibles: ['es', 'en'], navegador: [], pais: 'AR' }))
      .toEqual({ lang: 'es', motivo: 'pais' })
  })
  it('un hispanohablante en EE. UU. con el navegador en español se queda en español', () => {
    expect(elegirIdioma({ ...base, navegador: ['es-ES'], pais: 'US' }))
      .toEqual({ lang: 'es', motivo: 'navegador' })
  })
  it('sin señales, o con idiomas que no existen, se queda en el de la página', () => {
    expect(elegirIdioma({ ...base, navegador: ['ja-JP'], pais: 'JP' }))
      .toEqual({ lang: 'es', motivo: 'actual' })
    expect(elegirIdioma({ actual: 'es', disponibles: ['es'], navegador: ['en-US'], pais: 'US' }))
      .toEqual({ lang: 'es', motivo: 'actual' })
  })
  it('es estable: desde la página elegida no vuelve a cambiar (sin bucles)', () => {
    const entrada = { disponibles: ['es', 'en'], navegador: ['en-US'], pais: 'US' }
    const primera = elegirIdioma({ ...entrada, actual: 'es' })
    const segunda = elegirIdioma({ ...entrada, actual: primera.lang })
    expect(segunda.lang).toBe(primera.lang)
  })
})

describe('esRastreador', () => {
  it('detecta los rastreadores habituales', () => {
    expect(esRastreador('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
    expect(esRastreador('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true)
    expect(esRastreador('facebookexternalhit/1.1')).toBe(true)
  })
  it('no confunde un navegador normal', () => {
    expect(esRastreador('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')).toBe(false)
    expect(esRastreador('Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0 Safari/537.36')).toBe(false)
    expect(esRastreador(undefined)).toBe(false)
  })
})

describe('mapaHreflang', () => {
  it('une las versiones y marca el español como x-default', () => {
    const m = mapaHreflang('https://x.com', { lang: 'en', slug: 'a-en' }, [{ lang: 'es', slug: 'a-es' }])
    expect(m).toEqual({
      en: 'https://x.com/noticias/a-en',
      es: 'https://x.com/noticias/a-es',
      'x-default': 'https://x.com/noticias/a-es',
    })
  })
})

describe('textosFicha', () => {
  it('devuelve español por defecto e inglés cuando se pide', () => {
    expect(textosFicha().minLectura).toBe('min de lectura')
    expect(textosFicha('en').minLectura).toBe('min read')
    expect(textosFicha('en').aviso('en', 'pais').volver).toBe('Read in Español')
  })
})
