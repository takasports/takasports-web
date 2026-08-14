# TakaSports Web — CLAUDE.md

Plataforma deportiva de noticias, reels, eventos en vivo y juegos.
**Producción:** https://www.takasportsmedia.com (canonical `www.`, 301 desde non-www)

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| Estilos | Tailwind CSS |
| CMS noticias | Sanity (`cdn.sanity.io`) |
| Base de datos | Supabase (Postgres) |
| Auth | Supabase Auth |
| Imágenes externas | ESPN CDN, Wikimedia, Instagram CDN, Twitter CDN |
| Push notifications | Web Push (VAPID) |
| Analytics | Google Analytics 4 + Microsoft Clarity |
| Deploy | Vercel |

## Estructura de carpetas — dónde está cada cosa

```
src/
├── app/                    # Rutas Next.js App Router
│   ├── page.tsx            # Home
│   ├── noticias/           # Feed de noticias (Sanity)
│   ├── reels/              # Reels de Instagram
│   ├── calendario/         # Eventos + resultados históricos (Supabase: past_events)
│   ├── rankings/           # Índice Taka (Supabase: ranking_entries, ranking_view)
│   ├── quiniela/           # Juego de quinielas (Supabase: quiniela_*)
│   ├── estadisticas/       # Stats jugadores/equipos (api-sports.io)
│   ├── [sport]/            # Hub dinámico por deporte
│   ├── jugador/[slug]/     # Perfil jugador
│   ├── equipo/[slug]/      # Perfil equipo
│   ├── liga/[slug]/        # Perfil liga
│   ├── juegos/             # Mini-juegos (crackquiz, sopa-cracks, mionce)
│   ├── perfil/             # Perfil usuario
│   ├── admin/              # Panel admin (protegido)
│   └── api/                # API routes (ver sección API)
├── components/             # Componentes React reutilizables
└── lib/                    # Lógica de negocio, clientes, tipos
```

## API Routes clave

| Ruta | Función |
|---|---|
| `/api/events/live` `/api/events/upcoming` `/api/events/past` | Eventos ESPN |
| `/api/quiniela/*` | Sistema completo de quinielas |
| `/api/rankings/*` | Rankings Taka: ingest, override, search, audit |
| `/api/instagram/*` | Graph API oficial (tokens, reels, thumbnails) |
| `/api/stats/*` | Stats jugadores/standings (api-sports.io) |
| `/api/games/*` | Mini-juegos: plays, streaks, leaderboard |
| `/api/push/*` | Web Push subscribe/send |
| `/api/cron/*` | Cron jobs: push-reminders, sync-past-results, stat-snapshots |
| `/api/pipeline/status` | Health del pipeline n8n |
| `/api/sanity-webhook` | Webhook Sanity → reindex |

## Tablas Supabase

**Usuarios/Auth:** `profiles`, `push_subscriptions`, `newsletter_subscribers`

**Rankings (Índice Taka):**
- `ranking_entries` — jugadores rankeados (score 0–100)
- `ranking_view` — vista materializada con datos completos
- `ranking_edits` — overrides editoriales
- `ranking_score_history` — histórico de cambios de score
- `ranking_ingest_runs` — log de ingestas

**Quiniela:**
- `quiniela_picks`, `quiniela_leagues`, `quiniela_league_members`, `quiniela_league_member_scores`
- `quiniela_league_chat`, `quiniela_featured_picks`, `quiniela_season_predictions`, `quiniela_season_questions`
- `quiniela_coin_balance`, `quiniela_coin_txns`, `quiniela_badges`, `quiniela_odds_cache`

**Eventos:** `past_events` (resultados históricos cron ESPN), `game_events`

**Mini-juegos:** `game_plays`, `game_streaks`, `game_content`, `crackquiz_featured`, `mionce_editorial`, `sopa_cracks_featured`

**Stats:** `stat_block_snapshots`, `v_game_funnel_7d_summary`, `v_game_leaderboard`

**Comentarios:** `article_comments`, `article_comment_reports`

## Clientes Supabase

```typescript
// Cliente browser (componentes client):
import { createClient } from '@/lib/supabase'

// Cliente server (Server Components, API routes — usa service role key):
import { createAdminClient } from '@/lib/supabase-admin'
// o SSR:
import { createServerClient } from '@/lib/supabase-server'
```

## Servicios externos y sus límites

| Servicio | Variable | Límite / Notas |
|---|---|---|
| api-sports.io | `API_SPORTS_KEY` | ~100 req/día free. Usar con cuidado. |
| the-odds-api.com | `ODDS_API_KEY` | **500 req/mes AGOTADO** en free. NO usar en prod. Solo dev con `QUINIELA_DEV_ODDS`. |
| Sanity CDN | `NEXT_PUBLIC_SANITY_*` | Sin límite práctico. Contenido editorial. |
| Instagram Graph API | `INSTAGRAM_ACCESS_TOKEN` | Token de larga duración. `/api/instagram/refresh` lo renueva. |
| YouTube API | `YOUTUBE_API_KEY` | Solo scraping público, no producción. |

## Sistema editorial (Pipeline n8n + Sanity)

El contenido de noticias viene de n8n (taka-system) → Sanity. Claude Code **nunca genera ni republica noticias** directamente.

- Artículos: long-form 1300-1800 palabras, actualidad ≤3 días.
- Para eliminar artículo: borrar en Sanity + marcar `content_items` como `rejected` en Supabase (taka-system DB).
- Para publicar cambios web: `git push` → Vercel auto-deploy.
- **El TÍTULO SEO no lo genera el pipeline**: WF-07/WF-08 escriben `headline`, `metaDescription` y `focusKeyword`, pero NO `seoTitle`. Ese campo —el `<title>` que ve Google en los 2.647 artículos— lo rellena `scripts/auto-seo-title.mjs`, que corre por cron cada 15 min vía `~/.taka/run-seo.sh` (saca los tokens del contenedor `taka-n8n`, así que **si Docker está apagado no se genera ninguno** y solo se entera `~/.taka/seo.log`). Vivía suelto en el home sin versionar; ahora el real está aquí y en `~/.taka` queda un shim. Tres niveles: reformulación con IA (37%), compresión con IA (55%) y recorte del titular (9%).

## Rankings — sistema híbrido

- Score 0–100 = **fórmula determinista, SIN IA** (no hay Gemini). Suma ponderada de 4 factores (rendimiento/contexto/mediático/**forma**) con pesos por track — deportistas 45/20/15/20. Fuente de verdad del cálculo: trigger SQL `f_recompute_score_auto` (migración 110), espejado en `src/lib/rankings.ts`.
- **El pipeline de scoring vive EN ESTE REPO**: `scripts/weekly-rankings.mjs` (16 pasos) lo dispara launchd `com.taka.weekly-rankings-update` **dom 23:45 y mié 22:00**. Es la AUTORIDAD. Los scripts de `taka-system` (run-rankings.js, ingest-espn-*) solo siembran identidad y cobertura, y corren antes. Si tocas una fórmula allí y no la ves en la web, es que este pipeline la sobrescribió.
- **`active` tiene un dueño único**: `scripts/curate-active-entries.mjs`. Colapsa por IDENTIDAD (nombre+deporte+género) cruzando categorías, protege el núcleo curado del corte del top-N y respeta `suppressed`. Ningún otro script debe escribir `active` — cuatro procesos peleándose por esa columna hacían desaparecer cracks del ranking cada semana.
- **`suppressed`** (migración 116) = retirada editorial permanente, intocable por los automatismos. `editorial_locked` protege FACTORES; `suppressed` protege PRESENCIA.
- ⚠️ La PK de `ranking_entries` es **(id, category)** — el mismo id puede ser otra persona en otra categoría (`alcaraz-sub21` = futbolista del Everton en `jugadores`, tenista en `sub21`). Toda escritura debe filtrar por ambas.
- Dos capas: `*_auto` (cron) + `*_manual` (editorial), fusionadas por la vista materializada `ranking_view` vía `COALESCE(manual, auto)`. Tras cambiar datos: `SELECT refresh_ranking_view()`.
- Override editorial vía `POST /api/rankings/override` (requiere `RANKINGS_ADMIN_TOKEN`) o el panel `/admin/rankings`.
- Coste: $0 (fuentes públicas: Understat, ESPN, Elo ATP/WTA, Jolpica F1, Wikipedia).

## Convenciones de código

- **Componentes server** por defecto; añadir `'use client'` solo si necesita estado/efectos.
- **Imágenes:** siempre usar `<DynamicImage>` (wrapper con fallbacks) en lugar de `<Image>` directa para atletas/equipos.
- **Fechas:** usar `timeAgo()` de `@/lib/timeAgo` y `formatInTimezone()` de `@/lib/timezone`.
- **Tipos:** los tipos globales están en `@/lib/types.ts`.
- **Analytics:** eventos GA4 con `trackEvent()` de `@/lib/analytics`.
- **Tests:** vitest (`npm test`). Archivos `*.test.ts` junto al código que testean.
- **No hardcodear credenciales.** Siempre `.env.local`.

## Comandos frecuentes

```bash
npm run dev          # Dev server en :3000
npm run build        # Build producción (valida tipos y lint)
npm test             # Vitest
npm run rankings:sync   # Sincronizar rankings desde DB
```

## Qué NO hacer

- No usar `<Image>` de Next.js directamente para imágenes de atletas (usar `<DynamicImage>`).
- No llamar a the-odds-api en producción (cuota agotada).
- No publicar en redes sociales automáticamente desde este repo.
- No hacer capturas de pantalla para verificar cambios de texto/lógica — leer el código directamente.
- No re-explorar `node_modules/`, `next-env.d.ts`, `.next/` ni archivos generados.
- No commitear sin verificar que `npm run build` pasa.

## Archivos de referencia rápida

- Tipos principales: `src/lib/types.ts`
- Constantes deportes/ligas: `src/lib/constants.ts`, `src/lib/sports.ts`
- Datos estáticos rankings: `src/lib/rankings-data.ts`
- Config imagen externa: `next.config.ts` → `images.remotePatterns`
