-- Histórico semanal de followers de creadores → base para "Crecimiento" real
-- (hoy Crecimiento usa actividad videos/mes como proxy porque no había histórico).
CREATE TABLE IF NOT EXISTS public.creator_follower_snapshots (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  creator_id          text NOT NULL,
  effective_followers bigint,
  yt_subscribers      bigint,
  total_followers_raw bigint,
  captured_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_creator_follower_snap_cid_time
  ON public.creator_follower_snapshots (creator_id, captured_at DESC);

ALTER TABLE public.creator_follower_snapshots ENABLE ROW LEVEL SECURITY;
-- Solo service_role escribe/lee (el cron usa service role); sin acceso anon/authenticated.
REVOKE ALL ON public.creator_follower_snapshots FROM anon, authenticated;
GRANT ALL ON public.creator_follower_snapshots TO service_role;
