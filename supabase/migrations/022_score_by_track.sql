-- Migration 022: score_auto por TRACK (deportistas vs contenido)
--                + trigger en INSERT/UPDATE + backfill de saneo.
--
-- La fórmula del Índice depende del TRACK:
--   · Deportistas / clubes / entrenadores →
--       Rendimiento 0.40 · Contexto 0.20 · Mediático 0.25 · Narrativa 0.15
--   · Contenido (creadores / periodistas / creadores_wwe) → criterio PROPIO:
--       Audiencia(mediático) 0.50 · Contenido(rendimiento) 0.30 ·
--       Momento(narrativa) 0.15 · Profundidad(contexto) 0.05
--   Ambos + editorial_boost. Nulos → 50 (igual que la versión previa, migr. 020).
--
-- Por qué: el trigger 020 aplicaba 40/20/25/15 a TODAS las categorías, así que
-- corrompía el score de contenido si alguna vez se editaban sus factores
-- (la capa editorial de creadores YA usaba 50/30/15/5 al sembrar, de ahí que
-- los valores actuales sean correctos — esto blinda ese criterio). Además el
-- trigger pasa a dispararse también en INSERT, para que la DB quede siempre
-- canónica sin depender de la fórmula del endpoint de ingest.
--
-- CÓMO APLICAR: Supabase Dashboard → SQL Editor (o MCP apply_migration).

CREATE OR REPLACE FUNCTION public.f_recompute_score_auto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.category IN ('creadores', 'periodistas', 'creadores_wwe') THEN
    -- Contenido: Audiencia 0.50 · Contenido 0.30 · Momento 0.15 · Profundidad 0.05
    NEW.score_auto := ROUND(CAST(
        COALESCE(NEW.mediatico_auto,   50) * 0.50 +
        COALESCE(NEW.rendimiento_auto, 50) * 0.30 +
        COALESCE(NEW.narrativa_auto,   50) * 0.15 +
        COALESCE(NEW.contexto_auto,    50) * 0.05 +
        COALESCE(NEW.editorial_boost,   0)
      AS NUMERIC), 1);
  ELSE
    -- Deportistas: Rendimiento 0.40 · Contexto 0.20 · Mediático 0.25 · Narrativa 0.15
    NEW.score_auto := ROUND(CAST(
        COALESCE(NEW.rendimiento_auto, 50) * 0.40 +
        COALESCE(NEW.contexto_auto,    50) * 0.20 +
        COALESCE(NEW.mediatico_auto,   50) * 0.25 +
        COALESCE(NEW.narrativa_auto,   50) * 0.15 +
        COALESCE(NEW.editorial_boost,   0)
      AS NUMERIC), 1);
  END IF;
  RETURN NEW;
END;
$$;

-- Dispara en INSERT (siempre) y en UPDATE de los factores / boost.
-- En UPDATE de otras columnas (p.ej. image_url, score_auto del backfill) NO
-- dispara, así que el backfill de abajo fija el valor directamente.
DROP TRIGGER IF EXISTS trg_recompute_score_auto ON public.ranking_entries;
CREATE TRIGGER trg_recompute_score_auto
  BEFORE INSERT OR UPDATE OF
    rendimiento_auto, contexto_auto, mediatico_auto, narrativa_auto, editorial_boost
  ON public.ranking_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.f_recompute_score_auto();

-- Backfill idempotente: corrige SOLO filas no bloqueadas cuyo score_auto
-- difiera del canónico (las editorial_locked conservan su valor a mano).
WITH calc AS (
  SELECT id, category, ROUND(CAST(
      CASE WHEN category IN ('creadores', 'periodistas', 'creadores_wwe') THEN
        COALESCE(mediatico_auto,50)*0.50 + COALESCE(rendimiento_auto,50)*0.30 +
        COALESCE(narrativa_auto,50)*0.15 + COALESCE(contexto_auto,50)*0.05
      ELSE
        COALESCE(rendimiento_auto,50)*0.40 + COALESCE(contexto_auto,50)*0.20 +
        COALESCE(mediatico_auto,50)*0.25 + COALESCE(narrativa_auto,50)*0.15
      END + COALESCE(editorial_boost,0)
    AS NUMERIC), 1) AS canon
  FROM public.ranking_entries
  WHERE COALESCE(editorial_locked, false) = false
)
UPDATE public.ranking_entries e
SET score_auto = calc.canon
FROM calc
WHERE e.id = calc.id AND e.category = calc.category
  AND e.score_auto IS DISTINCT FROM calc.canon;
