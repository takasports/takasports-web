-- ─────────────────────────────────────────────────────────────────
-- LP3 — RLS completo para ranked_leagues y ranked_league_members
-- + RPC ranked_league_leaderboard
-- (ya aplicado a producción vía MCP)
-- ─────────────────────────────────────────────────────────────────

-- ranked_leagues: owner puede UPDATE y DELETE
CREATE POLICY rl_update_owner ON public.ranked_leagues
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY rl_delete_owner ON public.ranked_leagues
  FOR DELETE USING (auth.uid() = owner_id);

-- ranked_league_members: cada user puede eliminar su propio membership
CREATE POLICY rlm_delete_own ON public.ranked_league_members
  FOR DELETE USING (auth.uid() = user_id);

-- RPC: leaderboard interno de una liga privada
CREATE OR REPLACE FUNCTION public.ranked_league_leaderboard(
  p_league_id text
)
RETURNS TABLE (
  user_id      uuid,
  display_name text,
  avatar_url   text,
  total        bigint,
  rank         bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH members AS (
    SELECT m.user_id
    FROM ranked_league_members m
    WHERE m.league_id = p_league_id
  ),
  sport_row AS (
    SELECT sport FROM ranked_leagues WHERE id = p_league_id
  ),
  scores AS (
    SELECT
      m.user_id,
      COALESCE(SUM(rp.points_awarded), 0) AS total
    FROM members m
    LEFT JOIN ranked_predictions rp
      ON rp.user_id = m.user_id
      AND rp.points_awarded IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM ranked_events re
        WHERE re.id = rp.event_id
          AND re.sport = (SELECT sport FROM sport_row)
      )
    GROUP BY m.user_id
  )
  SELECT
    s.user_id,
    p.display_name,
    p.avatar_url,
    s.total,
    RANK() OVER (ORDER BY s.total DESC) AS rank
  FROM scores s
  JOIN profiles p ON p.id = s.user_id
  ORDER BY s.total DESC, p.display_name;
$$;

GRANT EXECUTE ON FUNCTION public.ranked_league_leaderboard(text) TO authenticated, service_role;
