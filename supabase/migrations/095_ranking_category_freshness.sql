-- 095 — frescura del Índice Taka POR CATEGORÍA (para el cron data-freshness).
-- El chequeo global max(last_auto_update) ocultaba paros PARCIALES: si una
-- categoría se quedaba vieja pero otra seguía actualizándose, la alarma nunca
-- saltaba. Esta función devuelve la última actualización por categoría para que
-- el cron avise de la categoría concreta que se haya quedado atrás.
-- SECURITY INVOKER: la llama el cron con la service_role key (adminSupabase);
-- revocada para anon/authenticated (no es API pública).
create or replace function public.f_ranking_category_freshness()
returns table(category text, last_update timestamptz, age_days numeric)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select category,
         max(last_auto_update) as last_update,
         round(extract(epoch from (now() - max(last_auto_update))) / 86400.0, 1) as age_days
  from public.ranking_entries
  group by category
$$;

revoke all on function public.f_ranking_category_freshness() from public, anon, authenticated;
grant execute on function public.f_ranking_category_freshness() to service_role;
