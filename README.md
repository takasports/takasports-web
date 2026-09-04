# TakaSports · web

Plataforma deportiva: noticias, calendario y resultados en vivo, rankings,
predicciones y minijuegos.

**Producción:** <https://www.takasportsmedia.com> · **Deploy:** Vercel, automático
en cada `push` a `main`.

| | |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript |
| Estilos | Tailwind 4 |
| Contenido | Sanity (noticias y reportajes) |
| Datos | Supabase (Postgres + Auth) |
| Deportes | ESPN (gratis) y api-sports.io (cuota corta) |
| Pruebas | Vitest — 1.250 en 89 ficheros |
| Tamaño | 68 páginas · 151 rutas de API · 28 tareas programadas |

## Arrancar

```bash
npm install && npm run dev
```

Hace falta un `.env.local` con unas 25 variables (Sanity, Supabase, claves de
deportes, VAPID de notificaciones). No hay fichero de ejemplo publicado porque
varias son secretas; pídeselas a quien mantiene el proyecto.

Sin `.env.local` la web arranca, pero las páginas que leen Sanity o Supabase
fallarán.

| Orden | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el 3000 |
| `npm run build` | Build de producción. **Valida tipos y lint: nada se commitea sin que pase** |
| `npm test` | Vitest, una pasada |
| `npm run rankings:sync` | Baja los rankings de la base de datos |

⚠️ **No levantes dos servidores de desarrollo en esta misma carpeta**: comparten
`.next` y todas las rutas de API empiezan a responder 404. Si necesitas otro, usa
un worktree de git aparte.

## Por dónde empezar a leer

```
src/
├── app/            rutas (App Router). Cada carpeta es una URL
│   ├── api/        151 rutas de servidor: eventos, predicciones, rankings, juegos, crons
│   ├── partido/    ficha de partido — la pantalla más grande y más visitada
│   └── admin/      panel interno, protegido
├── components/     React reutilizable
└── lib/            lógica de negocio, clientes y tipos
```

- **Tipos globales:** `src/lib/types.ts`
- **Deportes y ligas:** `src/lib/constants.ts`, `src/lib/sports.ts`
- **Fórmula del Índice Taka:** `src/lib/rankings.ts` (espejo del trigger SQL)
- **Imágenes externas permitidas:** `next.config.ts` → `images.remotePatterns`

## De dónde sale el contenido

Las noticias **no se escriben aquí**. Vienen de un pipeline de n8n que vive en
otro repo (`taka-system`), pasa por Supabase y se publica en Sanity; esta web
solo lee. El título SEO lo rellena aparte `/api/cron/seo-title`.

## Reglas de la casa

- **Componentes de servidor por defecto.** `'use client'` solo si necesita estado.
- **Imágenes de atletas y equipos:** `<DynamicImage>`, nunca `<Image>` a pelo.
- **Fechas:** `timeAgo()` y `formatInTimezone()`, que respetan el huso del visitante.
- **Nada decidido con el reloj del navegador en el primer render**, o rompes la
  hidratación: usa `useMounted()`. Costó once páginas repintándose enteras.
- **Sin credenciales en el código.** Siempre `.env.local`.
- **Medir en producción, no en local**: `next start` no comprime y miente por ocho.

## Documentación

- `CLAUDE.md` — guía larga del repo (tablas de Supabase, límites de cada API…)
- `CHANGELOG.md` — qué ha cambiado y cuándo
- Hoja de ruta viva: artifact «Hoja de ruta Taka»
