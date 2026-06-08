-- 069 — Cierra el aviso `function_search_path_mutable` (×7).
--
-- ALTER FUNCTION ... SET search_path = 'public' es un cambio de METADATA: NO
-- toca el cuerpo ni la volatilidad de las funciones, así que NO cambia su
-- comportamiento (todas operan sobre objetos del schema public).
--
-- f_unaccent es IMMUTABLE y se usa en 2 índices GIN (past_events_search_idx,
-- idx_ci_title_trgm); su cuerpo ya cualifica `public.unaccent(...)`, por lo que
-- fijar el search_path produce EXACTAMENTE el mismo resultado → los índices que
-- la referencian (por oid) quedan intactos, sin reindex.
--
-- Todas son SECURITY INVOKER (no DEFINER); esto solo elimina la mutabilidad del
-- search_path por higiene del advisor.

ALTER FUNCTION public.f_resolve_predictions(date)         SET search_path = 'public';
ALTER FUNCTION public.f_unaccent(text)                    SET search_path = 'public';
ALTER FUNCTION public.f_ranking_history_snapshot()        SET search_path = 'public';
ALTER FUNCTION public.f_recompute_badges()                SET search_path = 'public';
ALTER FUNCTION public.f_recompute_score_auto()            SET search_path = 'public';
ALTER FUNCTION public.f_ranking_snapshot_editorial()      SET search_path = 'public';
ALTER FUNCTION public.f_award_monthly_achievements(text)  SET search_path = 'public';
