-- 137_newsletter_envios.sql
-- Registro de envíos de la newsletter semanal (cron /api/cron/newsletter-semanal).
--
-- Para qué: que una edición NUNCA salga dos veces. La clave es la semana
-- ('semanal-2026-41'); un reintento del cron dentro de la misma semana es la
-- misma edición. `newsletter_entregas` lleva una fila por suscriptor, de modo
-- que un envío cortado a medias continúa con los que faltan en vez de repetir
-- a los primeros.
--
-- Sin esta migración el cron se niega a enviar (devuelve falta_migracion_137);
-- la vista previa (NEWSLETTER_ENABLED apagado) funciona sin ella.
--
-- Solo service_role: RLS activada y sin políticas; revocado a anon/authenticated
-- (mismo criterio que newsletter_subscribers, ver 077 y 135).

create table if not exists public.newsletter_ediciones (
  edicion        text primary key,                 -- 'semanal-2026-41'
  asunto         text not null,
  estado         text not null default 'enviando'
                 check (estado in ('enviando', 'enviada', 'fallida')),
  destinatarios  integer not null default 0,
  enviados       integer not null default 0,
  ultimo_error   text,
  creada_at      timestamptz not null default now(),
  terminada_at   timestamptz
);

create table if not exists public.newsletter_entregas (
  edicion        text not null references public.newsletter_ediciones(edicion) on delete cascade,
  subscriber_id  uuid not null references public.newsletter_subscribers(id) on delete cascade,
  resend_id      text,                              -- id del correo en Resend (para rastrear rebotes)
  enviada_at     timestamptz not null default now(),
  primary key (edicion, subscriber_id)
);

create index if not exists newsletter_entregas_subscriber_idx
  on public.newsletter_entregas (subscriber_id);

alter table public.newsletter_ediciones enable row level security;
alter table public.newsletter_entregas  enable row level security;

revoke all on public.newsletter_ediciones from anon, authenticated;
revoke all on public.newsletter_entregas  from anon, authenticated;

comment on table public.newsletter_ediciones is
  'Ediciones de la newsletter semanal. Una fila por semana; estado=enviada cierra la edición (idempotencia del cron).';
comment on table public.newsletter_entregas is
  'Una fila por (edición, suscriptor) enviada. El cron solo manda a quien no la tiene.';
