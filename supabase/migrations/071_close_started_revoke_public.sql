-- 071 — Completa el lockdown de close_started_ranked_events().
--
-- El REVOKE de anon/authenticated en la 070 NO bastó: el privilegio EXECUTE de
-- funciones se concede a PUBLIC por defecto, y todos los roles (anon,
-- authenticated) lo heredan de ahí. Hay que revocarlo de PUBLIC y garantizar
-- EXECUTE explícito a service_role (los 3 callers —ranked/events,
-- cron/sync-ufc, cron/sync-mundial— ya usan el cliente admin = service_role).
--
-- Orden: GRANT a service_role primero, luego REVOKE de PUBLIC/anon/authenticated
-- (atómico en la migración) → service_role conserva EXECUTE vía el grant
-- explícito; anon/authenticated lo pierden.

GRANT  EXECUTE ON FUNCTION public.close_started_ranked_events() TO service_role;
REVOKE EXECUTE ON FUNCTION public.close_started_ranked_events() FROM PUBLIC, anon, authenticated;
