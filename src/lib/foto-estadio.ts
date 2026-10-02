// Foto del estadio para la placa de una previa, de Wikimedia Commons.
//
// La placa con foto de fondo es la preferida del editor (02/10/2026), pero la foto
// de NOTICIAS del partido solo se usa si la cascada de WF-08 encuentra una muy
// buena, y casi nunca la hay un día antes. El estadio sí está siempre: Commons tiene
// fotos con licencia libre de casi todos los grandes, y una vista del campo donde se
// juega es exactamente la imagen de una previa.
//
// La búsqueda de Commons trae mucho ruido para "Stade de France": un muelle de
// Hamburgo, una estación de bicis, el logo, una primera piedra de 1995. De ahí los
// filtros: el título tiene que llevar las palabras distintivas del nombre, nada de
// logos/planos/obras, foto apaisada, ancha y con licencia libre.

const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'TakaSports/1.0 (https://www.takasportsmedia.com; contactotakasports@gmail.com)'

// Palabras que no distinguen un estadio de otro.
const GENERICAS = new Set([
  'estadio', 'stadium', 'stade', 'stadio', 'estadi', 'arena', 'center', 'centre', 'field', 'park',
  'de', 'del', 'la', 'el', 'los', 'the', 'of', 'di', 'do', 'da', 'municipal', 'nuevo', 'new',
])
// Títulos que casi nunca son una vista del estadio.
const RUIDO = /\b(logo|map|plan|plano|station|estaci[oó]n|gare|metro|construc|obras|pose|mural|art|ticket|entrada|seat|asiento|bus|tram|interior de la tienda|shop|tienda|museum|museo)\b/i
const LICENCIA_LIBRE = /^(cc0|public domain|cc by(-sa)? \d|cc by(-sa)? \d\.\d)/i

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export interface FotoEstadio { url: string; autor: string | null; licencia: string | null; titulo: string }

/** Puro: elige la mejor foto entre las páginas que devuelve la API. */
export function elegirFotoEstadio(estadio: string, paginas: Array<Record<string, any>>): FotoEstadio | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  const nombre = norm(estadio)
  const distintivas = nombre.split(' ').filter((w) => w.length > 2 && !GENERICAS.has(w))
  if (!distintivas.length) return null

  const candidatas = paginas.map((p) => {
    const ii = p?.imageinfo?.[0]
    if (!ii) return null
    const titulo = String(p.title ?? '').replace(/^File:/, '')
    const t = norm(titulo)
    const md = ii.extmetadata ?? {}
    const licencia = String(md.LicenseShortName?.value ?? '')
    const w = Number(ii.width), h = Number(ii.height)
    if (ii.mime !== 'image/jpeg' || !(w >= 1200) || !(h > 0)) return null
    const ratio = w / h
    if (ratio < 1.3 || ratio > 2.4) return null
    if (RUIDO.test(titulo) || !LICENCIA_LIBRE.test(licencia)) return null
    if (!distintivas.every((d) => t.includes(d))) return null
    const autor = String(md.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || null
    return {
      foto: { url: String(ii.thumburl ?? ii.url), autor, licencia: licencia || null, titulo },
      // Primero las que llevan el nombre completo; después, las más grandes.
      orden: (t.includes(nombre) ? 1e9 : 0) + w,
    }
  }).filter((x): x is { foto: FotoEstadio; orden: number } => !!x)

  candidatas.sort((a, b) => b.orden - a.orden)
  return candidatas[0]?.foto ?? null
}

export async function buscarFotoEstadio(estadio: string | null | undefined): Promise<FotoEstadio | null> {
  if (!estadio) return null
  const qs = new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: estadio, gsrnamespace: '6', gsrlimit: '15',
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiextmetadatafilter: 'LicenseShortName|Artist',
    iiurlwidth: '1600', format: 'json',
  })
  try {
    const r = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) return null
    const d = await r.json()
    return elegirFotoEstadio(estadio, Object.values(d?.query?.pages ?? {}))
  } catch {
    return null
  }
}
