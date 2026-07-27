-- f_sync ahora puntúa creadores Y creadores_wwe (antes solo creadores) desde métricas reales.
CREATE OR REPLACE FUNCTION public.f_sync_creator_scores()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_rec   record;
  v_prev  numeric;
  v_cat   text;
  v_sport text;
  v_rank  int;
  v_entry record;
begin
  for v_rec in
    select csv.creator_id, csv.score, csv.followers_score, csv.actividad_score, re.category AS cat
    from creator_scores_view csv
    join ranking_entries re on re.id = csv.creator_id and re.category in ('creadores','creadores_wwe')
  loop
    select score_auto into v_prev from ranking_entries where id = v_rec.creator_id and category = v_rec.cat;
    update ranking_entries set
      score_prev       = coalesce(v_prev, score_auto),
      mediatico_auto   = v_rec.followers_score,
      rendimiento_auto = v_rec.actividad_score,
      contexto_auto    = null,
      trend_auto = case
        when v_rec.score - coalesce(v_prev, v_rec.score) >= 3  then 'up2'
        when v_rec.score - coalesce(v_prev, v_rec.score) >= 1  then 'up'
        when v_rec.score - coalesce(v_prev, v_rec.score) <= -3 then 'down2'
        when v_rec.score - coalesce(v_prev, v_rec.score) <= -1 then 'down'
        else 'flat' end,
      active = true
    where id = v_rec.creator_id and category = v_rec.cat;
  end loop;

  for v_cat in select unnest(array['creadores','creadores_wwe']) loop
    for v_sport in select distinct sport from ranking_entries where category = v_cat and active = true loop
      v_rank := 1;
      for v_entry in
        select id from ranking_entries where category = v_cat and sport = v_sport and active = true
        order by score_auto desc nulls last
      loop
        update ranking_entries set rank_auto = v_rank where id = v_entry.id and category = v_cat;
        v_rank := v_rank + 1;
      end loop;
    end loop;
  end loop;
end;
$function$;
