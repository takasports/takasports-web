-- ─────────────────────────────────────────────────────────────────
-- 023 — Consenso real de la quiniela (sustituye datos sintéticos)
-- Lee de la audit table quiniela_picks y devuelve cuántos usuarios
-- eligieron cada outcome por partido. Deduplica por usuario tomando
-- la submission más reciente de cada partido.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.quiniela_consensus(p_jornada text)
returns table (home text, away text, p1 int, px int, p2 int, total int)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with latest as (
    select distinct on (p.user_id, elem->>'home', elem->>'away')
      p.user_id,
      elem->>'home' as home,
      elem->>'away' as away,
      elem->>'pick' as pick
    from public.quiniela_picks p,
         lateral jsonb_array_elements(p.picks->'picks') elem
    where p.jornada = p_jornada
    order by p.user_id, elem->>'home', elem->>'away', p.created_at desc
  )
  select
    home,
    away,
    sum(case when pick in ('1','1X')      then 1 else 0 end)::int as p1,
    sum(case when pick in ('X','1X','X2') then 1 else 0 end)::int as px,
    sum(case when pick in ('2','X2')      then 1 else 0 end)::int as p2,
    count(*)::int as total
  from latest
  group by home, away;
$$;

revoke all on function public.quiniela_consensus(text) from public;
grant execute on function public.quiniela_consensus(text) to anon, authenticated;
