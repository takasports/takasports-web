-- ─────────────────────────────────────────────────────────────────
-- 028 — Nueva fórmula de scoring para creadores/periodistas
--
-- Problema: la fórmula v8 fue diseñada para DEPORTISTAS
-- (rendimiento deportivo 40% + contexto competitivo 20%). Para
-- creadores de contenido esos pesos son erróneos.
--
-- Nueva fórmula creadores:
--   mediático × 0.50  → alcance real (followers/subs multiplataforma)
--   rendimiento × 0.30 → calidad y frecuencia de contenido
--   narrativa × 0.15   → momento editorial (trending/crecimiento)
--   contexto × 0.05    → profundidad temática
--
-- Fórmula deportistas (sin cambios):
--   rendimiento × 0.40 + contexto × 0.20 + mediático × 0.25 + narrativa × 0.15
--
-- CÓMO APLICAR:
--   Supabase Dashboard → SQL Editor → pegar y ejecutar.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.f_recompute_score_auto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.category IN ('creadores', 'periodistas', 'creadores_wwe') THEN
    -- Fórmula creadores: alcance (mediático) es el factor dominante
    NEW.score_auto := ROUND(CAST(
        COALESCE(NEW.mediatico_auto,   50) * 0.50 +
        COALESCE(NEW.rendimiento_auto, 50) * 0.30 +
        COALESCE(NEW.narrativa_auto,   50) * 0.15 +
        COALESCE(NEW.contexto_auto,    50) * 0.05 +
        COALESCE(NEW.editorial_boost,   0)
      AS NUMERIC), 1);
  ELSE
    -- Fórmula deportistas v8 (sin cambios)
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

-- Recalcular scores de todos los creadores/periodistas activos
-- usando la nueva fórmula directamente (sin necesidad de trigger)
UPDATE public.ranking_entries
SET score_auto = ROUND(CAST(
    COALESCE(mediatico_auto,   50) * 0.50 +
    COALESCE(rendimiento_auto, 50) * 0.30 +
    COALESCE(narrativa_auto,   50) * 0.15 +
    COALESCE(contexto_auto,    50) * 0.05
  AS NUMERIC), 1)
WHERE category IN ('creadores', 'periodistas', 'creadores_wwe');
