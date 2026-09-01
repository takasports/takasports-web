// Cuánto ve Google Analytics de lo que de verdad pasa.
//
// Por qué existe: GA4 solo se carga si el visitante pulsa "Aceptar" en el aviso
// de cookies (`ConsentBanner.tsx`, y está comentado allí como tal). Quien
// rechaza o ignora el aviso no aparece en ningún informe. El panel, en cambio,
// presentaba esa cifra como "Personas distintas que entraron ayer a la web",
// que es sencillamente falso.
//
// El tamaño del engaño, medido el 31/08/2026: Search Console daba 467 clics en
// una semana y GA4 unas 24 visitas/día. Search Console y GA4-orgánico miden casi
// lo mismo —gente que llega desde Google—, así que su cociente es una estimación
// razonable de qué fracción capta GA4.
//
// Esto NO arregla GA4; lo etiqueta. Arreglarlo de verdad exige o medir en el
// servidor sin cookies, o activar el Modo Consentimiento de Google (que envía
// pings sin cookies ANTES de aceptar). Lo segundo contradice lo que promete
// hoy el propio aviso —"solo se activan si pulsas Aceptar"—, así que es una
// decisión de privacidad del dueño del sitio, no del panel.

export interface CoberturaGa4 {
  /** Usuarios que GA4 registró en la ventana (todos los canales). */
  ga4Usuarios: number
  /** Los que GA4 atribuye a búsqueda, si sabe el porcentaje orgánico. */
  ga4Organico: number | null
  /** Clics desde Google en la misma ventana, según Search Console. */
  clicsBuscador: number
  /**
   * TECHO de cobertura: todo GA4 dividido entre los clics de búsqueda.
   * El numerador incluye directo y redes, así que INFLA a favor de GA4: la
   * cobertura real no puede ser mayor que esto. Es la cifra que se enseña
   * porque es la única indiscutible.
   */
  techo: number | null
  /**
   * Estimación más estricta, usando solo el orgánico de GA4. Suele salir mucho
   * peor, pero depende de la atribución de canal de GA4, que no es fiable
   * (parte del tráfico de Google acaba clasificado como "directo").
   */
  estricta: number | null
  /** ¿Hay bastantes datos para que el cociente signifique algo? */
  fiable: boolean
}

/** Con menos clics que esto, el cociente es ruido y no se enseña. */
const MINIMO_CLICS = 30

/**
 * Estima qué parte del tráfico real llega a GA4, comparando contra Search
 * Console: las dos miden lo mismo —gente que llega desde Google— y una exige
 * consentimiento mientras la otra no.
 */
export function coberturaGa4(
  ga4Usuarios: number | null | undefined,
  organicoPct: number | null | undefined,
  clicsBuscador: number | null | undefined,
): CoberturaGa4 {
  const usuarios = Number(ga4Usuarios ?? 0)
  const clics = Number(clicsBuscador ?? 0)
  const pctOrg = organicoPct == null ? null : Number(organicoPct)
  const ga4Organico = pctOrg == null ? null : Math.round((usuarios * pctOrg) / 100)

  const fiable = Number.isFinite(clics) && clics >= MINIMO_CLICS
  if (!fiable) {
    return { ga4Usuarios: usuarios, ga4Organico, clicsBuscador: clics, techo: null, estricta: null, fiable: false }
  }
  return {
    ga4Usuarios: usuarios,
    ga4Organico,
    clicsBuscador: clics,
    techo: usuarios / clics,
    estricta: ga4Organico == null ? null : ga4Organico / clics,
    fiable: true,
  }
}

/** Frase para el panel. Se apoya en el TECHO, que es lo que no admite discusión. */
export function textoCobertura(c: CoberturaGa4): string {
  if (!c.fiable || c.techo == null) return 'Sin datos suficientes para estimar la cobertura.'
  if (c.techo >= 1) return 'GA4 registra prácticamente todas las llegadas desde Google.'
  const techoPct = Math.round(c.techo * 100)
  const base = `GA4 ve COMO MUCHO el ${techoPct}% del tráfico real, y esa cifra ya le favorece: compara todos sus usuarios (incluidos los que llegan directos o de redes) contra los clics que solo vienen de Google. El resto rechaza o ignora el aviso de cookies y no aparece en ningún informe.`
  if (c.estricta == null || c.estricta >= c.techo) return base
  return `${base} Contando solo lo que GA4 atribuye a búsqueda, bajaría al ${Math.round(c.estricta * 100)}%.`
}
