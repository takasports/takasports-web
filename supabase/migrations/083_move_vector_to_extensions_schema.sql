-- 083 — F2-resto·A (3/3): sacar vector (pgvector) del schema public (advisor lint extension_in_public).
-- Aplicada en Supabase vía MCP (2026-06-20) y verificada: vector queda en `extensions`,
-- content_items.embedding sigue siendo vector(1536) (193 filas), el índice HNSW
-- idx_content_items_embedding sobrevive sin REINDEX, y match_articles con un embedding real
-- devuelve resultados (operador <=> + tipo vector resueltos desde extensions).
--
-- get_advisors(security) tras los 3 pasos: 0 ERRORES y 0 avisos extension_in_public.
-- Rollback (si hiciera falta): alter extension vector set schema public; + revertir el search_path.

-- 1) match_articles usa el operador de distancia <=> y el tipo vector sin cualificar.
alter function public.match_articles(vector, double precision, integer, integer)
  set search_path = public, extensions, pg_temp;

-- 2) Mover la extensión. El tipo vector, el opclass vector_cosine_ops y el operador <=> se
--    reubican; la columna content_items.embedding y el índice HNSW dependen por OID → sin REINDEX.
alter extension vector set schema extensions;
