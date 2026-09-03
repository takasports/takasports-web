// ESPN publica la altura en pies y pulgadas (`displayHeight: "5' 10\""`). En un
// medio en español eso no dice nada: la web y la app lo pintaban tal cual en la
// ficha del jugador (medido el 03/09/2026 en producción y en el simulador de
// iOS). Se convierte aquí, en la API, para que las dos plataformas lo reciban ya
// resuelto —la app es un cliente delgado de esta API— en vez de duplicar el
// parseo en cada cliente.

/**
 * Devuelve la altura en metros con coma decimal ("1,78 m").
 *
 * Si la cadena ya viene en métrico, o no se puede interpretar, se devuelve tal
 * cual: es preferible enseñar el dato original de ESPN que tragárselo.
 */
export function alturaEnMetros(displayHeight: string | null | undefined): string | undefined {
  if (!displayHeight) return undefined
  const bruto = displayHeight.trim()
  if (!bruto) return undefined

  // Ya está en métrico ("1,78 m", "178 cm"): no tocar.
  if (/\d\s*(m|cm)\b/i.test(bruto)) return bruto

  // `5' 10"`, `5'10`, `6'` … Las comillas de ESPN a veces son tipográficas (′ ″).
  const m = bruto.match(/^(\d{1,2})\s*['′]\s*(\d{1,2}(?:[.,]\d+)?)?\s*["″]?$/)
  if (!m) return bruto

  const pies = Number(m[1])
  const pulgadas = m[2] ? Number(m[2].replace(',', '.')) : 0
  if (!Number.isFinite(pies) || pies <= 0 || !Number.isFinite(pulgadas) || pulgadas >= 12) return bruto

  const metros = (pies * 12 + pulgadas) * 0.0254
  if (!Number.isFinite(metros) || metros <= 0 || metros > 3) return bruto

  return `${metros.toFixed(2).replace('.', ',')} m`
}
