import { describe, expect, it } from 'vitest'
import { elegirFotoEstadio } from '@/lib/foto-estadio'

const pag = (title: string, w: number, h: number, licencia = 'CC BY-SA 4.0', mime = 'image/jpeg') => ({
  title: `File:${title}`,
  imageinfo: [{ width: w, height: h, mime, url: `https://u/${title}`, thumburl: `https://t/${title}`, extmetadata: { LicenseShortName: { value: licencia }, Artist: { value: '<a href="x">Autor</a>' } } }],
})

describe('elegirFotoEstadio', () => {
  // Resultados reales de Commons para "Stade de France" (02/10/2026), recortados.
  const stade = [
    pag('Stade, Hansehafen -- 2018 -- 2961.jpg', 6720, 4480),
    pag('Logo Stade de France - 2013.svg', 600, 88, 'Public domain', 'image/svg+xml'),
    pag('Station Vélib Gare Plaine Stade France St Denis Seine St Denis 2.jpg', 4032, 3024),
    pag('Make art not war - Stade de France.JPG', 3264, 2448),
    pag('Stade de France, Olympics 2024.jpg', 4160, 3120),
    pag('Stade de France 5 August 2024.jpg', 4032, 3024, 'CC0'),
  ]

  it('descarta el ruido y se queda con una vista del estadio', () => {
    const f = elegirFotoEstadio('Stade de France', stade)
    expect(f?.titulo).toBe('Stade de France, Olympics 2024.jpg')
    expect(f?.url).toBe('https://t/Stade de France, Olympics 2024.jpg')
    expect(f?.autor).toBe('Autor')
  })

  it('exige las palabras distintivas del nombre', () => {
    const f = elegirFotoEstadio('Estadio Metropolitano', [pag('Madrid - Estadio Wanda Metropolitano 07.jpg', 2045, 1500, 'CC0')])
    expect(f?.titulo).toContain('Metropolitano')
    expect(elegirFotoEstadio('Estadio Metropolitano', [pag('Estadio Bernabéu.jpg', 3000, 2000)])).toBeNull()
  })

  it('no acepta verticales, pequeñas ni sin licencia libre', () => {
    expect(elegirFotoEstadio('Scotiabank Arena', [pag('Scotiabank Arena Exterior.jpg', 4284, 5712)])).toBeNull()
    expect(elegirFotoEstadio('Scotiabank Arena', [pag('Scotiabank Arena.jpg', 1024, 768)])).toBeNull()
    expect(elegirFotoEstadio('Scotiabank Arena', [pag('Scotiabank Arena.jpg', 4000, 2500, 'All rights reserved')])).toBeNull()
  })
})
