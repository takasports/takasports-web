// Ningún <Link> a un espacio de URL COMBINATORIO puede precargarse.
//
// ── Por qué existe esta prueba ───────────────────────────────────────────────
// En el App Router, un `<Link>` se PRECARGA solo con aparecer en pantalla. Como
// `/comparar?p1=X&p2=Y` y `/rankings/comparar?a=<id>` tienen una URL distinta por
// cada ficha, cada enlace visible provoca un render de servidor nuevo, con la
// caché siempre en MISS, sin que nadie haya pulsado nada. Una lista de rankings
// con 25 filas dispara 25 renders al abrirse.
//
// Esto ya tumbó el sitio DOS veces:
//
//   18/08/2026 · ~10.000 renders en 3 horas saturaron Postgres y se llevaron por
//                delante el pipeline editorial. Se arregló A MEDIAS: se bloqueó
//                /comparar en robots.txt, pero robots.txt no tiene nada que decir
//                sobre el prefetch, que lo dispara el navegador de un usuario real.
//   17/09/2026 · 1.899 peticiones a /comparar en 3 días, TODAS con caché MISS,
//                contra 501 de /rankings, que es la página que las origina. La
//                última a las 09:07:09; el proyecto de Vercel se pausó por
//                exceder el límite de facturación a las 09:07.
//
// Por eso la prueba mira el ATRIBUTO y no solo robots.txt: son dos problemas
// distintos y hasta hoy solo uno estaba resuelto. [18/09/2026]

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const RAIZ = resolve(__dirname, '../..')

/** Rutas cuya URL cambia por cada entidad: el espacio es combinatorio. */
const COMBINATORIAS = /href=\{?`?\/(comparar|comparar-equipos|rankings\/comparar)/

function ficheros(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...ficheros(p))
    else if (e.endsWith('.tsx')) out.push(p)
  }
  return out
}

describe('los enlaces a páginas combinatorias no se precargan', () => {
  it('todo <Link> a comparar lleva prefetch={false}', () => {
    const sinProteger: string[] = []

    for (const f of [...ficheros(join(RAIZ, 'src/app')), ...ficheros(join(RAIZ, 'src/components'))]) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/<Link\b/g)) {
        // 420 caracteres cubren de sobra los atributos de una etiqueta de apertura.
        const etiqueta = src.slice(m.index!, m.index! + 420)
        if (!COMBINATORIAS.test(etiqueta)) continue
        if (/prefetch=\{false\}/.test(etiqueta)) continue
        const linea = src.slice(0, m.index!).split('\n').length
        sinProteger.push(`${f.replace(RAIZ + '/', '')}:${linea}`)
      }
    }

    expect(sinProteger).toEqual([])
  })

  it('robots.txt sigue bloqueando esas rutas, que es el OTRO medio problema', () => {
    // Las dos defensas hacen falta: robots.txt para los rastreadores, el
    // prefetch para los navegadores de usuarios reales. Arreglar una sola deja
    // el agujero abierto, que es exactamente lo que ha pasado desde agosto.
    const robots = readFileSync(join(RAIZ, 'src/app/robots.ts'), 'utf8')
    expect(robots).toContain('/comparar')
    expect(robots).toContain('/rankings/comparar')
  })
})
