-- 082 — F2-resto·A (2/3): sacar unaccent del schema public (advisor lint extension_in_public).
-- Aplicada en Supabase vía MCP (2026-06-20) y verificada: unaccent queda en `extensions`,
-- f_unaccent('Atlético')='Atletico', search_players('messi') devuelve filas, y los 2 índices
-- GIN (idx_ci_title_trgm, past_events_search_idx) siguen sin REINDEX.
--
-- f_unaccent tenía 'public.unaccent' escrito a fuego (función + 'public.unaccent'::regdictionary)
-- con search_path fijado a 'public' (migr. 069). Lo reescribimos SIN cualificar: resuelve la
-- función y el diccionario unaccent vía search_path (public Y extensions). Mismo resultado
-- (IMMUTABLE) → CREATE OR REPLACE conserva el OID → los índices GIN quedan válidos sin REINDEX.

-- 1) f_unaccent agnóstica del schema.
create or replace function public.f_unaccent(text)
  returns text
  language sql
  immutable parallel safe strict
  set search_path = public, extensions, pg_temp
as $function$ select unaccent('unaccent'::regdictionary, $1) $function$;

-- 2) search_players llama unaccent() sin cualificar → añadir extensions al search_path.
alter function public.search_players(text, integer)
  set search_path = public, extensions, pg_temp;

-- 3) Mover la extensión (incluye la función unaccent y el text-search dictionary unaccent).
alter extension unaccent set schema extensions;
