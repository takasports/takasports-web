-- Rebalanceo de pesos de DEPORTISTAS: Rendimiento 45 · Contexto 20 · Forma 20 · Mediático 15.
-- "Forma" vive en narrativa_auto (momentum del score). La rama de creadores NO cambia.
CREATE OR REPLACE FUNCTION public.f_recompute_score_auto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.category IN ('creadores', 'periodistas', 'creadores_wwe') THEN
    NEW.score_auto := ROUND(CAST(
        COALESCE(NEW.mediatico_auto,   50) * 0.50 +
        COALESCE(NEW.rendimiento_auto, 50) * 0.30 +
        COALESCE(NEW.narrativa_auto,   50) * 0.15 +
        COALESCE(NEW.contexto_auto,    50) * 0.05 +
        COALESCE(NEW.editorial_boost,   0)
      AS NUMERIC), 1);
  ELSE
    -- Deportistas: Rendimiento 45 · Contexto 20 · Forma(narrativa_auto) 20 · Mediático 15
    NEW.score_auto := ROUND(CAST(
        COALESCE(NEW.rendimiento_auto, 50) * 0.45 +
        COALESCE(NEW.contexto_auto,    50) * 0.20 +
        COALESCE(NEW.narrativa_auto,   50) * 0.20 +
        COALESCE(NEW.mediatico_auto,   50) * 0.15 +
        COALESCE(NEW.editorial_boost,   0)
      AS NUMERIC), 1);
  END IF;
  RETURN NEW;
END;
$function$;
