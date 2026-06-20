-- 080 — F2 seguridad: cerrar 2 vistas SECURITY DEFINER (advisor ERROR) + matview en la API (WARN).
-- Aplicada en Supabase vía MCP (2026-06-20) y verificada: get_advisors(security) ya NO reporta
-- security_definer_view (entry_favorites_count, weekly_poll_results) ni materialized_view_in_api (ranking_view).
--
--   · entry_favorites_count = SELECT count(*) FROM user_favorites GROUP BY entry_id (sin consumidores en el código).
--   · weekly_poll_results   = SELECT count(*) FROM weekly_votes  (solo lo lee /api/rankings/poll, WeeklyPoll muerto).
--   · ranking_view (matview) = se lee SOLO server-side con service_role; no debe ser accesible por anon.
-- Impacto en features vivas: ninguno (service_role ignora estos grants; las rutas vivas no leen estas vistas con anon).

-- 1) Las 2 vistas dejan de ser SECURITY DEFINER → respetan el RLS del que consulta.
alter view public.entry_favorites_count set (security_invoker = on);
alter view public.weekly_poll_results  set (security_invoker = on);

-- 2) Quitar los grants de ESCRITURA absurdos (GRANT ALL heredado) en esas vistas.
revoke insert, update, delete, truncate, references, trigger
  on public.entry_favorites_count, public.weekly_poll_results
  from anon, authenticated;

-- 3) La matview, fuera del alcance de anon/authenticated (el servidor la lee con service_role).
revoke select on public.ranking_view from anon, authenticated;
