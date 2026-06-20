-- 081 — F2-resto·A (1/3): sacar pg_trgm del schema public (advisor lint extension_in_public).
-- Aplicada en Supabase vía MCP (2026-06-20) y verificada: pg_trgm queda en `extensions`,
-- el índice idx_ci_title_trgm sobrevive sin REINDEX, y match_articles_by_title sigue
-- devolviendo resultados (similarity() + operador % resueltos desde extensions).
--
-- Truco de seguridad: primero se blinda el search_path de la función (que incluye public
-- Y extensions), de modo que resuelve antes y después del move. Así no hay estado roto a medias.

-- 1) match_articles_by_title usa similarity() y el operador % sin cualificar.
alter function public.match_articles_by_title(text, uuid, text, integer, real)
  set search_path = public, extensions, pg_catalog;

-- 2) Mover la extensión. El opclass gin_trgm_ops del índice idx_ci_title_trgm se referencia
--    por OID → el índice sigue válido sin REINDEX.
alter extension pg_trgm set schema extensions;
