// ¿Esta petición viene de alguien que ya está navegando por Taka?
//
// Los comparadores (/comparar, /comparar-equipos) tienen un espacio de URLs
// combinatorio: cada pareja ?p1=…&p2=… es un render de servidor nuevo que,
// además, pide las fichas a /api/jugador y /api/team. En octubre de 2026 un
// robot que se presentaba como navegador (ignorando robots.txt, que ya prohíbe
// /comparar) los recorrió a ~460 renders por hora, todos sin caché, el mismo
// patrón que pausó la web por facturación en septiembre.
//
// Una persona llega a una pareja concreta haciendo clic dentro de la web, y su
// navegador lo dice: `Sec-Fetch-Site: same-origin` (Chrome, Firefox, Safari
// 16.4+) o, como respaldo, un `Referer` de nuestro dominio. Quien entra de
// fuera con una pareja ya montada recibe el comparador vacío para elegir, que
// es barato; el coste caro solo se paga cuando la navegación es propia.

const HOSTS_PROPIOS = /(^|\.)takasportsmedia\.com$|\.vercel\.app$|^localhost$|^127\.0\.0\.1$/

function hostDe(valor: string | null): string | null {
  if (!valor) return null
  try {
    return new URL(valor).hostname
  } catch {
    return null
  }
}

export function esNavegacionPropia(h: Pick<Headers, 'get'>): boolean {
  const site = h.get('sec-fetch-site')
  if (site === 'same-origin') return true
  const host = hostDe(h.get('referer'))
  return host !== null && HOSTS_PROPIOS.test(host)
}
