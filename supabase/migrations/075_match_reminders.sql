-- Fase G·1 — Recordatorios de partido del calendario.
-- Anónimo: ligado al `endpoint` de la suscripción push (sin requerir login).
-- El cron /api/cron/calendar-reminders lee `kickoff_iso` para avisar ~10-15 min
-- antes del inicio (push real, funciona con la web cerrada).
-- Aditivo e idempotente.

create table if not exists match_reminders (
  endpoint    text not null references push_subscriptions(endpoint) on delete cascade,
  match_ref   text not null,
  kickoff_iso timestamptz not null,
  home        text not null,
  away        text,
  comp        text,
  url         text,
  notified    boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (endpoint, match_ref)
);

-- El cron consulta los no notificados con kickoff próximo.
create index if not exists match_reminders_due_idx
  on match_reminders (kickoff_iso) where notified = false;

alter table match_reminders enable row level security;

-- Modelo de seguridad MÁS ESTRICTO que push_subscriptions (que tiene insert
-- abierto): aquí NO se crean políticas para anon → la tabla queda cerrada a
-- clientes anónimos. Solo el service role (las rutas /api/push/reminders y el
-- cron, vía adminSupabase) escribe/lee, bypaseando RLS. Evita que alguien
-- inyecte recordatorios para endpoints ajenos.
