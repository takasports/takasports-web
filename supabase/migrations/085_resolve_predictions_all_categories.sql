-- Bug: predict-resolver-faltan-categorias (informe revisión integral, §5.6 Rankings)
-- El mini-juego "¿Quién será #1 el próximo lunes?" (PredictWidget del Índice Taka)
-- deja predecir en las 12 categorías de ranking_view, pero f_resolve_predictions
-- solo resolvía 6 (lista hardcodeada). Las 6 huérfanas (clubes_femenino, concacaf,
-- creadores_wwe, latam, luchadoras_ufc, sub21) quedaban con is_correct = NULL para
-- siempre. ranking_view ya contiene las 12 categorías pobladas, así que basta con
-- quitar el filtro WHERE para resolverlas todas con la misma lógica (#1 por score).
-- Se conserva SET search_path TO 'public' (hardening de la migración 069).
CREATE OR REPLACE FUNCTION public.f_resolve_predictions(
  target_week date DEFAULT (date_trunc('week'::text, now()))::date
)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  WITH winners AS (
    SELECT DISTINCT ON (category) category, id AS winner_id
    FROM ranking_view
    -- sin WHERE: cubre las 12 categorías presentes en ranking_view
    ORDER BY category, score DESC NULLS LAST
  )
  UPDATE index_predictions p
  SET is_correct = (p.predicted_entry_id = w.winner_id),
      resolved_at = now()
  FROM winners w
  WHERE p.week_start = target_week AND p.category = w.category AND p.is_correct IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;
