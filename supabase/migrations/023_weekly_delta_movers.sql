-- Migration 023: "Mayores subidas" honestas — delta semanal persistente + saneo
--
-- Problema raíz: getTopMovers usaba (score - score_prev) EN VIVO, pero el
-- snapshot promueve score_prev = score_auto al FINAL de cada ingest. Resultado:
-- ese delta vale 0 para entradas sanas y solo es != 0 cuando el snapshot está
-- OBSOLETO. Por eso el widget mostraba artefactos (entrenadores con score_prev
-- congelado el 2026-05-08 → "+11.3" falsos) y nunca movimiento real.
--
-- Fix: persistir la MAGNITUD del cambio semanal en el momento del recompute
-- (cuando score_prev todavía es el de la semana pasada, antes del promote), en
-- delta_week. getTopMovers lee esa columna (estable toda la semana) + filtros.
-- Aditivo: no cambia la lógica de score/trend existente.

-- 1) Columna para el delta semanal persistente
ALTER TABLE public.ranking_entries ADD COLUMN IF NOT EXISTS delta_week numeric;

-- 2) recompute_trends ahora guarda también la magnitud del cambio semanal
--    (misma resta que ya usa para la dirección — solo se persiste).
CREATE OR REPLACE FUNCTION public.f_ranking_recompute_trends()
RETURNS void LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
begin
  update ranking_entries
     set trend_auto = case
       when score_auto - score_prev >= 3  then 'up2'
       when score_auto - score_prev >= 1  then 'up'
       when score_auto - score_prev <= -3 then 'down2'
       when score_auto - score_prev <= -1 then 'down'
       else 'flat'
     end,
         delta_week = round((score_auto - score_prev)::numeric, 1)
   where score_prev is not null and score_auto is not null;
end;
$function$;

-- 3) Exponer delta_week en la vista. CREATE OR REPLACE (append al final) conserva
--    grants y dependencias. Reproduce la definición vigente + la nueva columna.
CREATE OR REPLACE VIEW public.ranking_view AS
 SELECT id,
    category,
    name,
    subtitle,
    sport,
    emoji,
    image_url,
    country,
    league,
    "position",
    region,
    gender,
    COALESCE(badge_manual, badge) AS badge,
    featured,
    handles,
    jsonb_build_object('rendimiento', COALESCE(rendimiento_manual, rendimiento_auto), 'contexto', COALESCE(contexto_manual, contexto_auto), 'mediatico', COALESCE(mediatico_manual, mediatico_auto), 'narrativa', COALESCE(narrativa_manual, narrativa_auto)) AS factors,
    COALESCE(score_manual, score_auto) AS score,
    rank() OVER (PARTITION BY category ORDER BY (COALESCE(score_manual, score_auto)) DESC NULLS LAST, (COALESCE(mediatico_manual, mediatico_auto, 50::numeric)) DESC NULLS LAST)::integer AS rank,
    COALESCE(trend_manual, trend_auto, 'flat'::text) AS trend,
    COALESCE(insight_manual, insight_auto) AS insight,
    COALESCE(trend_reason_manual, trend_reason_auto) AS trend_reason,
    score_sport_auto AS score_sport,
        CASE
            WHEN score_sport_auto IS NOT NULL THEN rank() OVER (PARTITION BY sport ORDER BY score_sport_auto DESC NULLS LAST, (COALESCE(mediatico_manual, mediatico_auto, 50::numeric)) DESC NULLS LAST)::integer
            ELSE NULL::integer
        END AS rank_sport,
    COALESCE(editorial_boost, 0::numeric)::numeric(4,2) AS editorial_boost,
    editorial_note,
    editorial_locked,
    score_prev,
    rank_prev,
    score_manual IS NOT NULL OR rank_manual IS NOT NULL OR insight_manual IS NOT NULL OR trend_manual IS NOT NULL OR rendimiento_manual IS NOT NULL OR contexto_manual IS NOT NULL OR mediatico_manual IS NOT NULL OR narrativa_manual IS NOT NULL OR editorial_boost IS NOT NULL OR badge_manual IS NOT NULL AS has_override,
    last_auto_update,
    last_manual_update,
    updated_at,
    delta_week
   FROM ranking_entries e
  WHERE active = true;

-- 4) Sanear el baseline OBSOLETO de entrenadores (score_prev del 2026-05-08 →
--    deltas falsos de +11). Tras promover, su delta queda 0; dejamos la flecha
--    en flat (honesta) y delta_week null hasta el próximo ingest real.
SELECT public.f_ranking_promote_snapshot('entrenadores');
UPDATE public.ranking_entries
   SET trend_auto = 'flat', delta_week = NULL
 WHERE category = 'entrenadores' AND active = true AND editorial_locked = false;
