-- Permite p_sport = NULL para ranking global (todos los deportes sumados).
-- Reemplaza la versión anterior que requería sport obligatorio.
CREATE OR REPLACE FUNCTION get_ranked_leaderboard(p_sport text DEFAULT NULL, p_limit integer DEFAULT 50)
RETURNS TABLE (user_id uuid, display_name text, avatar_url text, total_points bigint, rank bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    pt.user_id,
    pr.display_name,
    pr.avatar_url,
    SUM(pt.amount)                                  AS total_points,
    RANK() OVER (ORDER BY SUM(pt.amount) DESC)      AS rank
  FROM   point_transactions pt
  LEFT JOIN profiles pr ON pr.id = pt.user_id
  WHERE  (p_sport IS NULL OR pt.sport = p_sport)
  GROUP BY pt.user_id, pr.display_name, pr.avatar_url
  ORDER  BY total_points DESC
  LIMIT  p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_ranked_leaderboard(text, integer) TO anon, authenticated;
