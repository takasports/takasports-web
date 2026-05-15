-- Migration 020: trigger que recalcula score_auto cuando cambia cualquier factor
-- Garantiza que score_auto siempre refleja los datos más recientes,
-- independientemente de qué script actualizó qué factor.
--
-- Fórmula v6: rendimiento×0.40 + contexto×0.20 + mediático×0.25 + narrativa×0.15 + boost

CREATE OR REPLACE FUNCTION public.f_recompute_score_auto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.score_auto := ROUND(CAST(
      COALESCE(NEW.rendimiento_auto, 50) * 0.40 +
      COALESCE(NEW.contexto_auto,    50) * 0.20 +
      COALESCE(NEW.mediatico_auto,   50) * 0.25 +
      COALESCE(NEW.narrativa_auto,   50) * 0.15 +
      COALESCE(NEW.editorial_boost,   0)
    AS NUMERIC), 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_score_auto ON public.ranking_entries;
CREATE TRIGGER trg_recompute_score_auto
  BEFORE UPDATE OF
    rendimiento_auto, contexto_auto, mediatico_auto, narrativa_auto, editorial_boost
  ON public.ranking_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.f_recompute_score_auto();
