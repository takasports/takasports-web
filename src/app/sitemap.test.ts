// El sitemap no vuelve a llevarse la base de jugadores entera.
//
// ── Qué problema resuelve ────────────────────────────────────────────────────
// El 31/08/2026 el sitemap pasó de 431 fichas de jugador a 7.212, con un
// argumento razonable: el sitio posiciona nombres de persona y la ficha es
// perenne donde la noticia caduca. Tres semanas de datos dicen que no:
//
//   Search Console, 19/08–15/09/2026, solo /jugador/
//     7.212 URLs publicadas · 4.930 llegaron a aparecer
//     53.820 impresiones · 30 clics · 0,06 % · posición media 20,8
//
// Treinta clics en cuatro semanas. Y el precio: ese rastreo golpeaba
// /api/jugador/[slug], que entonces no tenía caché, y fue una de las dos causas
// de que Vercel pausara el proyecto el 17/09/2026 por límite de gasto.
//
// La decisión NO es "ninguna ficha": es "solo las que tienen demanda". Se
// quedan las que publica `statRoutes` —goleadores y asistentes de cada liga,
// 459 hoy— y se va el barrido de `sport_entities`. Por eso la prueba cuenta
// sitios de construcción en vez de prohibir la ruta: si mañana aparece una
// segunda fuente masiva, salta. [18/09/2026]

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const FUENTE = readFileSync(join(resolve(__dirname, '../..'), 'src/app/sitemap.ts'), 'utf8')

/** Nombre de la función que contiene un desplazamiento dado del fichero. */
function funcionQueContiene(pos: number): string {
  const antes = FUENTE.slice(0, pos)
  const decls = [...antes.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g)]
  return decls.length ? decls[decls.length - 1][1] : '(nivel superior)'
}

describe('el sitemap no publica la base de jugadores entera', () => {
  const sitios = [...FUENTE.matchAll(/\$\{BASE_URL\}\/jugador\//g)]

  it('solo hay UN sitio donde se construyen URLs de ficha', () => {
    expect(sitios.map((m) => funcionQueContiene(m.index!))).toEqual(['statRoutes'])
  })

  it('no se vuelve a consultar sport_entities para publicar fichas', () => {
    // `playerNames` sí consulta `sport_entities`, pero solo para la política de
    // etiquetas: saca NOMBRES, no rutas. Lo que no puede volver es el filtro por
    // foto resuelta, que era el que producía los miles de URLs.
    expect(FUENTE).not.toContain('sport_entity_images')
  })
})
