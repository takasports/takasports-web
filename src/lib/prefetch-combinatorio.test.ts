// Ningún <Link> a una página SIN CACHÉ puede precargarse.
//
// ── Qué problema resuelve ────────────────────────────────────────────────────
// En el App Router un `<Link>` se PRECARGA solo con aparecer en pantalla. Si la
// página de destino se sirve de la caché del CDN eso es gratis y bueno: la
// navegación va instantánea. Pero si la página NO se cachea —porque es
// `force-dynamic`, o porque su URL es distinta por cada entidad y nunca repite—
// cada enlace visible provoca **un render de servidor nuevo sin que nadie haya
// pulsado nada**. Una lista de 25 filas dispara 25 renders al abrirse.
//
// ── Lo que ha costado ────────────────────────────────────────────────────────
//   18/08/2026 · ~10.000 renders de /comparar en 3 h saturaron Postgres y se
//                llevaron por delante el pipeline editorial. Se bloqueó la ruta
//                en robots.txt y ahí quedó.
//   17/09/2026 · Vercel pausó el proyecto por superar el límite de facturación.
//                /comparar: 1.899 peticiones en 3 días, todas con caché MISS,
//                la última a las 09:07:09; la pausa, a las 09:07.
//                /tag/[tag]: 2.017 renders en 3 días, nunca cacheados, para
//                UN clic de Google en 28 días.
//
// robots.txt no arregla esto: el prefetch no lo hace un rastreador, lo hace el
// navegador de un usuario real. Son dos defensas distintas.
//
// ── Por qué la prueba descubre las rutas sola ────────────────────────────────
// La primera versión llevaba la lista escrita a mano y habría dejado pasar
// /tag/[tag], que tiene exactamente el mismo problema. Ahora lee `src/app`,
// averigua QUÉ rutas no se cachean y comprueba que nadie las precargue. Una
// ruta nueva sin caché queda cubierta el día que se crea. [18/09/2026]

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const RAIZ = resolve(__dirname, '../..')

function ficheros(dir: string, nombre?: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...ficheros(p, nombre))
    else if (nombre ? e === nombre : e.endsWith('.tsx')) out.push(p)
  }
  return out
}

/** Rutas que NO se cachean: `force-dynamic`, o espacio de URL combinatorio. */
function rutasSinCache(): string[] {
  const out: string[] = []
  for (const p of ficheros(join(RAIZ, 'src/app'), 'page.tsx')) {
    const src = readFileSync(p, 'utf8')
    if (!/force-dynamic/.test(src)) continue
    const ruta = p
      .replace(join(RAIZ, 'src/app'), '')
      .replace('/page.tsx', '')
      .replace(/\/\([^)]+\)/g, '') // grupos de rutas: (public) no va en la URL
    if (ruta) out.push(ruta)
  }
  // Las de comparar sí se cachean por URL, pero su URL es distinta por cada par
  // de entidades: en la práctica no repiten nunca y la caché siempre falla.
  out.push('/comparar', '/comparar-equipos', '/rankings/comparar')
  return [...new Set(out)]
}

/** `/tag/[tag]` → prefijo `/tag/` para reconocer los href. */
const prefijo = (ruta: string) => ruta.replace(/\/\[[^\]]+\]$/, '/').replace(/\/$/, '/')

/**
 * A dónde apunta un <Link>: la ruta literal del href, o —si el href es una
 * variable— la ruta que esa variable construye unas líneas más arriba.
 *
 * El caso de la variable no es rebuscado: es justo el de las dos páginas de
 * comparar, que arman el href con un ternario (`const href = t1 ? … : …`)
 * porque el destino cambia según si ya has elegido la primera entidad. La
 * primera versión de esta prueba solo miraba hrefs literales y por eso dejó
 * pasar la rejilla de equipos de /comparar-equipos: 80 enlaces, cada uno una
 * URL distinta y sin cachear. [18/09/2026]
 */
function objetivo(src: string, etiqueta: string): string | null {
  const literal = etiqueta.match(/href=\{?`?(\/[^`"'\s{}]*)/)?.[1]
  if (literal) return literal

  const variable = etiqueta.match(/href=\{(\w+)\}/)?.[1]
  if (!variable) return null
  const decl = src.match(new RegExp(`const\\s+${variable}\\s*(?::[^=]+)?=`))
  if (decl?.index == null) return null
  // 400 caracteres cubren un ternario de dos ramas con sus plantillas.
  return src.slice(decl.index, decl.index + 400).match(/[`'"](\/[^`'"$\s]*)/)?.[1] ?? null
}

describe('los enlaces a páginas sin caché no se precargan', () => {
  const sinCache = rutasSinCache()

  it('detecta las rutas sin caché del proyecto', () => {
    // Si esto se queda vacío, la prueba de abajo no comprobaría nada.
    expect(sinCache.length).toBeGreaterThan(2)
    expect(sinCache).toContain('/tag/[tag]')
    expect(sinCache).toContain('/comparar')
  })

  it('ningún <Link> a una de ellas lleva prefetch activo', () => {
    const prefijos = sinCache.map(prefijo).filter((p) => p !== '/')
    const apunta = (url: string) =>
      prefijos.some((p) => url === p.replace(/\/$/, '') || url.startsWith(p))
    const sinProteger: string[] = []

    for (const f of [...ficheros(join(RAIZ, 'src/app')), ...ficheros(join(RAIZ, 'src/components'))]) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/<Link\b/g)) {
        // 420 caracteres cubren de sobra los atributos de una etiqueta de apertura.
        const etiqueta = src.slice(m.index!, m.index! + 420)
        const destino = objetivo(src, etiqueta)
        if (!destino || !apunta(destino)) continue
        if (/prefetch=\{false\}/.test(etiqueta)) continue
        const linea = src.slice(0, m.index!).split('\n').length
        sinProteger.push(`${f.replace(RAIZ + '/', '')}:${linea} → ${destino}`)
      }
    }

    expect(sinProteger).toEqual([])
  })

  it('robots.txt sigue bloqueando las combinatorias, que es la OTRA defensa', () => {
    // Hacen falta las dos: robots.txt para los rastreadores, el prefetch para
    // los navegadores de usuarios reales. Arreglar una sola deja el agujero
    // abierto, que es exactamente lo que pasó entre agosto y septiembre.
    const robots = readFileSync(join(RAIZ, 'src/app/robots.ts'), 'utf8')
    expect(robots).toContain('/comparar')
    expect(robots).toContain('/rankings/comparar')
  })
})
