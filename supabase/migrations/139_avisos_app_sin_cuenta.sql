-- Avisos de la app sin cuenta (1.0.14).
-- La agenda de las 22:00 necesita la zona horaria del móvil, y «hoy juega tu equipo»
-- solo llegaba a quien tenía cuenta porque los equipos seguidos vivían en
-- user_favorites. Un móvil sin cuenta guarda ahora los suyos junto al token.
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS agenda_sent_for date,
  ADD COLUMN IF NOT EXISTS teams text[] NOT NULL DEFAULT '{}';

-- Mismo registro que avisos_equipo_log, por token: allí user_id apunta a auth.users.
CREATE TABLE IF NOT EXISTS public.avisos_equipo_token_log (
  token    text        NOT NULL,
  kind     text        NOT NULL CHECK (kind IN ('equipo_hoy', 'equipo_final')),
  ref      text        NOT NULL,
  sent_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token, kind, ref)
);
CREATE INDEX IF NOT EXISTS avisos_equipo_token_log_sent_at_idx
  ON public.avisos_equipo_token_log (sent_at);
ALTER TABLE public.avisos_equipo_token_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.avisos_equipo_token_log FROM anon, authenticated;
