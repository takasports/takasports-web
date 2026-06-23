-- 093 — Columna `meta` (jsonb) opcional en user_favorites. Permite que la
-- takasports-app guarde en la nube los datos mínimos para pintar un favorito sin
-- re-descargarlo (noticias: título/imagen; equipos/ligas: nombre/escudo). El web
-- y los consumidores existentes solo leen entry_id → meta es transparente para
-- ellos. NULL para las fichas del Índice (Mi Top), que se resuelven de ranking_view.
--
-- Aditiva, nullable, riesgo nulo. Aplicada en vivo vía MCP (Supabase project
-- ybjmokuppfcnptyouagr). get_advisors(security) tras el DDL: 0 ERRORES.

alter table public.user_favorites add column if not exists meta jsonb;

comment on column public.user_favorites.meta is
  'Datos mínimos opcionales para reconstruir el favorito sin re-descargarlo (noticias: title/imageUrl/publishedAt/sport/category). NULL para fichas del Índice (Mi Top), que se resuelven de ranking_view. Lo escribe la app vía /api/rankings/favorites.';
