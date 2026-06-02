-- ─────────────────────────────────────────────────────────────────
-- UF — Columnas UFC en ranked_events
--
-- Añade fighter_a y fighter_b a ranked_events para poder guardar
-- los nombres de los luchadores UFC sin mezclarlos con team_home/away.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.ranked_events
  ADD COLUMN IF NOT EXISTS fighter_a text,
  ADD COLUMN IF NOT EXISTS fighter_b text;

COMMENT ON COLUMN public.ranked_events.fighter_a IS 'Nombre del luchador A (solo sport=ufc)';
COMMENT ON COLUMN public.ranked_events.fighter_b IS 'Nombre del luchador B (solo sport=ufc)';
