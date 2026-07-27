-- Creadores → Audiencia 50 · Actividad(→Crecimiento) 25 · Relevancia 25 + editorial.
-- (1) Trigger: rama creadores a 50/25/25 (mediatico/rendimiento/narrativa), sin contexto.
CREATE OR REPLACE FUNCTION public.f_recompute_score_auto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.category IN ('creadores', 'periodistas', 'creadores_wwe') THEN
    NEW.score_auto := ROUND(CAST(
        COALESCE(NEW.mediatico_auto,   50) * 0.50 +
        COALESCE(NEW.rendimiento_auto, 50) * 0.25 +
        COALESCE(NEW.narrativa_auto,   50) * 0.25 +
        COALESCE(NEW.editorial_boost,   0)
      AS NUMERIC), 1);
  ELSE
    -- Deportistas: Rendimiento 45 · Contexto 20 · Mediático 15 · Forma 20
    NEW.score_auto := ROUND(CAST(
        COALESCE(NEW.rendimiento_auto, 50) * 0.45 +
        COALESCE(NEW.contexto_auto,    50) * 0.20 +
        COALESCE(NEW.mediatico_auto,   50) * 0.15 +
        COALESCE(NEW.narrativa_auto,   50) * 0.20 +
        COALESCE(NEW.editorial_boost,   0)
      AS NUMERIC), 1);
  END IF;
  RETURN NEW;
END;
$function$;

-- (2) f_sync_creator_scores: ya NO borra narrativa_auto (guarda la Relevancia de Wikipedia).
--     mediatico=followers (Audiencia), rendimiento=actividad (Crecimiento interino).
--     El score lo fija el trigger desde los factores (no lo forzamos aquí).
CREATE OR REPLACE FUNCTION public.f_sync_creator_scores()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_rec   record;
  v_prev  numeric;
  v_sport text;
  v_rank  int;
  v_entry record;
begin
  for v_rec in
    select csv.creator_id, csv.score, csv.followers_score, csv.actividad_score
    from creator_scores_view csv
    where exists (select 1 from ranking_entries re where re.id = csv.creator_id and re.category = 'creadores')
  loop
    select score_auto into v_prev from ranking_entries where id = v_rec.creator_id and category = 'creadores';
    update ranking_entries set
      score_prev       = coalesce(v_prev, score_auto),
      mediatico_auto   = v_rec.followers_score,
      rendimiento_auto = v_rec.actividad_score,
      contexto_auto    = null,
      -- narrativa_auto: NO se toca → conserva la Relevancia (Wikipedia)
      trend_auto = case
        when v_rec.score - coalesce(v_prev, v_rec.score) >= 3  then 'up2'
        when v_rec.score - coalesce(v_prev, v_rec.score) >= 1  then 'up'
        when v_rec.score - coalesce(v_prev, v_rec.score) <= -3 then 'down2'
        when v_rec.score - coalesce(v_prev, v_rec.score) <= -1 then 'down'
        else 'flat' end,
      active = true
    where id = v_rec.creator_id and category = 'creadores';
  end loop;

  for v_sport in select distinct sport from ranking_entries where category = 'creadores' and active = true
  loop
    v_rank := 1;
    for v_entry in
      select id from ranking_entries where category = 'creadores' and sport = v_sport and active = true
      order by score_auto desc nulls last
    loop
      update ranking_entries set rank_auto = v_rank where id = v_entry.id and category = 'creadores';
      v_rank := v_rank + 1;
    end loop;
  end loop;
end;
$function$;
