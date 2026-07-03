-- 098_favorites_push_log.sql  ·  F6 (robustez de crons)
--
-- QUÉ ARREGLA (idempotencia de favorites-push): el cron de notificaciones de
-- favoritos (lunes 09:30) manda un push por usuario y semana, pero SIN registro
-- de a quién ya había avisado. Si Vercel reintentaba el cron (timeout) o se
-- re-disparaba, los usuarios ya notificados recibían el MISMO aviso otra vez.
--
-- FIX: log (user_id, week) con PK compuesta. El cron RECLAMA cada par antes de
-- enviar (insert ... on conflict do nothing → solo envía a los recién reclamados)
-- = at-most-once: un reintento en la misma semana no manda nada.
--
-- Tabla TÉCNICA (como push_subscriptions): solo service_role. RLS activo SIN
-- policies bloquea anon/authenticated; `on delete cascade` la limpia al borrar la
-- cuenta (no va al export RGPD, sin valor de portabilidad).

create table if not exists public.favorites_push_log (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  week        text        not null,
  notified_at timestamptz not null default now(),
  primary key (user_id, week)
);

alter table public.favorites_push_log enable row level security;

revoke all on public.favorites_push_log from anon, authenticated;
grant select, insert, delete on public.favorites_push_log to service_role;
