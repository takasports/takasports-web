import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// El middleware emite un CSP con un nonce NUEVO por request en las rutas de su
// matcher. Next solo puede escribir ese nonce en sus <script> inline si
// renderiza la página en esa misma request: si la página se prerenderiza, el
// HTML cacheado no lleva nonce, el navegador bloquea TODOS los scripts inline y
// la página no hidrata nunca.
//
// Eso es lo que dejaba `/perfil` en blanco (solo el esqueleto de loading.tsx)
// para cualquier visitante sin sesión, medido en producción el 03/09/2026.
// Ver el comentario largo en src/app/(public)/perfil/layout.tsx.
//
// `/admin` y `/archivo` no necesitan declararlo: leen la sesión en servidor y
// eso ya las hace dinámicas. `/perfil` son cascarones 'use client' sin lectura
// de sesión, así que su render dinámico hay que declararlo a mano.

const raiz = join(__dirname, '..', '..')

describe('CSP con nonce y render de las rutas de perfil', () => {
  it('el middleware sigue cubriendo /perfil (si deja de hacerlo, este test sobra)', () => {
    const middleware = readFileSync(join(raiz, 'src', 'middleware.ts'), 'utf8')
    expect(middleware).toContain("'/perfil/:path*'")
    expect(middleware).toMatch(/script-src[^`]*nonce-\$\{nonce\}/)
  })

  it('el layout de /perfil declara render dinámico, o el nonce no llega al HTML', () => {
    const layout = readFileSync(
      join(raiz, 'src', 'app', '(public)', 'perfil', 'layout.tsx'),
      'utf8',
    )
    expect(layout).toMatch(/export const dynamic = 'force-dynamic'/)
  })

  it('ninguna página de /perfil reintroduce un revalidate que la vuelva a cachear', () => {
    const paginas = [
      ['page.tsx'],
      ['album', 'page.tsx'],
      ['onces', 'page.tsx'],
      ['[userId]', 'page.tsx'],
    ]
    for (const partes of paginas) {
      const ruta = join(raiz, 'src', 'app', '(public)', 'perfil', ...partes)
      if (!existsSync(ruta)) continue
      const src = readFileSync(ruta, 'utf8')
      expect.soft(src, `${partes.join('/')} no debe exportar revalidate`).not.toMatch(
        /^export const revalidate/m,
      )
      expect.soft(src, `${partes.join('/')} no debe forzar render estático`).not.toMatch(
        /^export const dynamic = '(force-static|error)'/m,
      )
    }
  })
})
