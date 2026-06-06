-- Migration 024: delta_week y trend sobre el score MOSTRADO (coalesce manual→auto)
--
-- Casi todos los entrenadores (y otras entradas) llevan score_manual (override
-- editorial). El snapshot guardaba score_prev = score_auto, pero el score que ve
-- el usuario es el manual → una entrada fijada a mano podía aparecer como "mover"
-- por movimiento del auto-score aunque su número mostrado no cambie.
--
-- Fix: el snapshot y el recompute usan COALESCE(score_manual, score_auto) — el
-- mismo valor que muestra la vista. Así el delta refleja el movimiento REAL del
-- número visible (override pinneado → delta 0).

-- promote: score_prev = score MOSTRADO
CREATE OR REPLACE FUNCTION public.f_ranking_promote_snapshot(p_category text)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
declare v_count bigint;
begin
  select count(*) into v_count from ranking_entries where category = p_category and active = true;
  if v_count > 0 then
    insert into ranking_snapshots (snapshot_date, category, entries, total_entries)
    select current_date, p_category,
      coalesce(jsonb_agg(to_jsonb(rv.*) order by rv.rank), '[]'::jsonb), count(*)
    from ranking_view rv where rv.category = p_category
    on conflict (snapshot_date, category) do update
      set entries = excluded.entries, total_entries = excluded.total_entries;
  end if;

  update ranking_entries
     set score_prev         = COALESCE(score_manual, score_auto),
         rank_prev          = rank_auto,
         prev_snapshot_date = now()
   where category = p_category and active = true and editorial_locked = false;
end;
$function$;

-- recompute: trend + delta_week sobre el score MOSTRADO
CREATE OR REPLACE FUNCTION public.f_ranking_recompute_trends()
RETURNS void LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
begin
  update ranking_entries
     set trend_auto = case
       when COALESCE(score_manual, score_auto) - score_prev >= 3  then 'up2'
       when COALESCE(score_manual, score_auto) - score_prev >= 1  then 'up'
       when COALESCE(score_manual, score_auto) - score_prev <= -3 then 'down2'
       when COALESCE(score_manual, score_auto) - score_prev <= -1 then 'down'
       else 'flat'
     end,
         delta_week = round((COALESCE(score_manual, score_auto) - score_prev)::numeric, 1)
   where score_prev is not null and COALESCE(score_manual, score_auto) is not null;
end;
$function$;

-- Re-sanear entrenadores con el promote corregido → su delta mostrado queda 0
SELECT public.f_ranking_promote_snapshot('entrenadores');
UPDATE public.ranking_entries
   SET trend_auto = 'flat', delta_week = NULL
 WHERE category = 'entrenadores' AND active = true AND editorial_locked = false;
