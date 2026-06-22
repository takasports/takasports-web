-- 086 · Arregla la pestaña "global" de la Liga Taka.
--
-- get_ranked_leaderboard filtraba con `WHERE pt.sport = p_sport`. La pestaña
-- "global" pasa p_sport = NULL, y en Postgres `pt.sport = NULL` evalúa a NULL
-- (nunca TRUE) → el listado GLOBAL salía VACÍO. Como los puntos de minijuegos se
-- graban con sport='all' y ninguna pestaña filtra 'all', esos puntos no aparecían
-- en NINGÚN ranking. Con el fix, p_sport NULL = global (suma TODO: predicciones
-- Mundial/UFC + minijuegos). Las pestañas por deporte quedan idénticas.
--
-- CREATE OR REPLACE conserva firma, SECURITY DEFINER y search_path; solo cambia el WHERE.
-- (Aplicada en vivo a ybjmokuppfcnptyouagr; point_transactions=0 filas = pre-lanzamiento.)
CREATE OR REPLACE FUNCTION public.get_ranked_leaderboard(p_sport text, p_limit integer DEFAULT 50)
 RETURNS TABLE(user_id uuid, display_name text, avatar_url text, total_points bigint, rank bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    pt.user_id,
    pr.display_name,
    pr.avatar_url,
    SUM(pt.amount)                          AS total_points,
    RANK() OVER (ORDER BY SUM(pt.amount) DESC) AS rank
  FROM point_transactions pt
  LEFT JOIN profiles pr ON pr.id = pt.user_id
  WHERE (p_sport IS NULL OR pt.sport = p_sport)
  GROUP BY pt.user_id, pr.display_name, pr.avatar_url
  ORDER BY total_points DESC
  LIMIT p_limit;
$function$;
