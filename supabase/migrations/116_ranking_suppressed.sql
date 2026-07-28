-- 116_ranking_suppressed.sql
-- Retirada editorial PERMANENTE de una entrada del ranking.
--
-- Problema que resuelve: `active` lo reescriben varios procesos automáticos
-- (curate-active-entries.mjs semanal, f_sync_creator_scores, los ingests de
-- taka-system). Poner `active=false` a mano — desde el panel /admin/rankings o
-- por SQL — dura hasta la siguiente corrida: el domingo vuelve a activarse.
--
-- `suppressed` es el candado: significa "esta entrada NO debe salir NUNCA,
-- decisión editorial". Todos los procesos automáticos lo respetan.
--   · editorial_locked → "no toques mis FACTORES" (ya existía)
--   · suppressed       → "no la resucites NUNCA" (esto)
--
-- Con esto se acaba también el gotcha de creadores: f_sync_creator_scores()
-- reactivaba a cualquiera presente en creator_raw_metrics, así que para quitar
-- a un creador había que borrarlo de la tabla de métricas. Ya no.

alter table ranking_entries
  add column if not exists suppressed boolean not null default false;

comment on column ranking_entries.suppressed is
  'Retirada editorial permanente: ningún proceso automático puede reactivar esta entrada. Distinto de editorial_locked (que solo protege los factores).';

-- Índice parcial: las consultas normales solo miran las NO suprimidas.
create index if not exists idx_ranking_entries_suppressed
  on ranking_entries (suppressed) where suppressed = true;

-- Coherencia: lo suprimido está inactivo por definición.
update ranking_entries set active = false where suppressed = true and active = true;

-- ── f_sync_creator_scores(): respeta suppressed ──────────────────────────────
-- Único cambio respecto a la versión de la migración 113: el join descarta las
-- entradas suprimidas, así que ni se repuntúan ni se reactivan.
create or replace function f_sync_creator_scores()
returns void
language plpgsql
security definer
as $$
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
    join ranking_entries re on re.id = csv.creator_id
     and re.category in ('creadores','creadores_wwe')
     and coalesce(re.suppressed, false) = false
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
        select re.id
        from ranking_entries re
        left join creator_scores_view csv on csv.creator_id = re.id
        where re.category = v_cat and re.sport = v_sport and re.active = true
        order by re.score_auto desc nulls last, coalesce(csv.effective_followers, 0) desc, re.name
      loop
        update ranking_entries set rank_auto = v_rank where id = v_entry.id and category = v_cat;
        v_rank := v_rank + 1;
      end loop;
    end loop;
  end loop;
end;
$$;
