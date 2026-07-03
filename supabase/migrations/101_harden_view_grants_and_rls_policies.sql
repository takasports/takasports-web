-- 101_harden_view_grants_and_rls_policies.sql  ·  F4 (endurecimiento BD)
--
-- Pase conservador de higiene RLS/grants. NO cambia quién puede hacer qué; revoca
-- permisos que sobran y colapsa duplicados/ALL. Aplicada por MCP y verificada
-- (pg_policies + role_table_grants). Ver informe F4.
--
-- (2) Vistas de solo-lectura con INSERT/UPDATE/DELETE residual para anon/authenticated
--     (la 080 no las cubrió). Las vistas no son escribibles por esos roles; el
--     grant es riesgo latente → se revoca (SELECT intacto).
revoke insert, update, delete on
  public.creator_scores_view,
  public.ranking_edits_narrative_outliers,
  public.v_game_funnel_30d,
  public.v_game_funnel_7d_summary,
  public.v_game_global_week,
  public.v_game_leaderboard
from anon, authenticated;

-- (3) push_subscriptions: `psub_self` (ALL, public) ya cubre SELECT/INSERT/UPDATE/
--     DELETE incluida la gestión de subs anónimas (user_id IS NULL). Las tres
--     policies granulares quedan SUBSUMIDAS (RLS permisivo = OR) → se eliminan.
--     Comportamiento efectivo idéntico.
drop policy if exists push_subs_insert on public.push_subscriptions;
drop policy if exists push_subs_update on public.push_subscriptions;
drop policy if exists push_subs_delete on public.push_subscriptions;

-- (4) ALL de escritura → INSERT/UPDATE/DELETE explícitas con la MISMA condición,
--     para no mezclar escritura con el SELECT (ya cubierto por *_read).
--     past_events: solo service_role escribe.
drop policy if exists past_events_write on public.past_events;
create policy past_events_insert on public.past_events for insert
  with check ((select auth.role()) = 'service_role');
create policy past_events_update on public.past_events for update
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');
create policy past_events_delete on public.past_events for delete
  using ((select auth.role()) = 'service_role');

--     quiniela_user_equipment: cada usuario solo su propia fila.
drop policy if exists eq_write on public.quiniela_user_equipment;
create policy eq_insert on public.quiniela_user_equipment for insert
  with check ((select auth.uid()) = user_id);
create policy eq_update on public.quiniela_user_equipment for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy eq_delete on public.quiniela_user_equipment for delete
  using ((select auth.uid()) = user_id);
