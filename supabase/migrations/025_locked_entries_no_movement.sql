-- Migration 025: las entradas editorial_locked (pinneadas a mano) NO se mueven
--
-- f_ranking_promote_snapshot excluye a las bloqueadas (no toca su score_prev),
-- así que su baseline puede quedar obsoleto y, al recomputar, producir un
-- delta_week falso (p.ej. entrenadores bloqueados con score_prev del 2026-05-08
-- → "+11"). Una entrada pinneada editorialmente no tiene movimiento algorítmico
-- semanal → su delta_week debe ser 0 y su tendencia flat.

CREATE OR REPLACE FUNCTION public.f_ranking_recompute_trends()
RETURNS void LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
begin
  update ranking_entries
     set trend_auto = case
       when editorial_locked then 'flat'
       when COALESCE(score_manual, score_auto) - score_prev >= 3  then 'up2'
       when COALESCE(score_manual, score_auto) - score_prev >= 1  then 'up'
       when COALESCE(score_manual, score_auto) - score_prev <= -3 then 'down2'
       when COALESCE(score_manual, score_auto) - score_prev <= -1 then 'down'
       else 'flat'
     end,
         delta_week = case
           when editorial_locked then 0
           else round((COALESCE(score_manual, score_auto) - score_prev)::numeric, 1)
         end
   where score_prev is not null and COALESCE(score_manual, score_auto) is not null;
end;
$function$;

-- Limpieza puntual de las bloqueadas actuales: sin movimiento.
UPDATE public.ranking_entries
   SET delta_week = 0, trend_auto = 'flat'
 WHERE editorial_locked = true AND active = true;
