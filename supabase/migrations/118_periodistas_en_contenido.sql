-- 118_periodistas_en_contenido.sql
-- Los periodistas pasan a puntuarse como los creadores: una sola categoría
-- CONTENIDO en el producto.
--
-- ── POR QUÉ ──────────────────────────────────────────────────────
-- Hasta ahora convivían en el mismo track pero con dos escalas incomparables:
-- la del creador salía de datos medibles (audiencia real, crecimiento,
-- engagement de YouTube) y la del periodista era un `score_manual` puesto a
-- mano, porque se dio por hecho que de ellos no había métrica que recoger. Con
-- la nota a mano encabezaban la lista por decreto; con la fórmula, y sin datos,
-- se habrían aplanado todos en un 50.
--
-- Ya no hace falta elegir: **60 de los 63 periodistas tienen Instagram**, que sí
-- se puede medir, y 9 tienen canal de YouTube. Pasan por el mismo pipeline
-- (anchor-creator-youtube → verify-creator-handles → ingest-creator-relevance)
-- y con eso su audiencia es tan real como la de un creador.
--
-- `f_sync_creator_scores()` los incluye, y el trigger f_recompute_score_auto ya
-- los trataba con la fórmula de contenido (50/25/25) desde la migración 111.

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
     and re.category in ('creadores','creadores_wwe','periodistas')
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

  for v_cat in select unnest(array['creadores','creadores_wwe','periodistas']) loop
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
