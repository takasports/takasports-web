// ── Cuánto NO estamos midiendo ────────────────────────────────────────────────
//
// La analítica (GA4 + Clarity) solo se carga tras un «Aceptar» explícito
// —decisión del dueño del 14/06/2026, apoyada en las Directrices 2/2023 del
// EDPB: incluso el ping sin cookies es «acceso al equipo terminal»—. Perfecto de
// cara al reglamento, pero significa que TODO número de GA4 es un suelo, no una
// medida.
//
// Search Console SÍ es insesgado: cuenta cada clic desde Google pase lo que pase
// con el banner. Comparando los dos sale el factor de corrección.
//
// Medido el 04/09/2026 a 28 días: GA4 684 sesiones frente a 1.422 clics de
// búsqueda → como mucho el 48%. Y es un techo: las 684 incluyen tráfico directo
// y social, así que la cobertura real de la búsqueda es aún menor.
/** Lo mínimo que necesita el cálculo (subconjunto de `TrafficHistoryDay`). */
export interface DiaDeTrafico {
  visits: number | null
  clics: number | null
}

export interface CoberturaMedicion {
  /** Visitas que GA4 llegó a ver en la ventana. */
  medidas: number
  /** Clics desde Google en la misma ventana. Insesgado. */
  reales: number
  /** Porcentaje que la analítica alcanza a ver, 0-100. `null` si faltan datos. */
  cobertura: number | null
  dias: number
}

export function coberturaDeMedicion(historia: DiaDeTrafico[]): CoberturaMedicion {
  const utiles = historia.filter((d) => d.clics != null && d.clics > 0)
  const medidas = utiles.reduce((s, d) => s + (d.visits ?? 0), 0)
  const reales = utiles.reduce((s, d) => s + (d.clics ?? 0), 0)
  return {
    medidas,
    reales,
    cobertura: reales > 0 ? Math.round((medidas / reales) * 100) : null,
    dias: utiles.length,
  }
}

