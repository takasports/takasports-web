-- 034_newsletter_subscribers.sql
-- Captura de emails para la newsletter de TakaSports.
-- Opt-in simple con consentimiento explícito (RGPD: la UI exige checkbox).
-- El envío real de newsletters se delega a otra capa (n8n / proveedor
-- externo) que consume esta tabla.

create table if not exists newsletter_subscribers (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  consent_at   timestamptz not null default now(),
  source       text not null default 'web',     -- 'web' | 'app' | 'import' | ...
  user_agent   text,                             -- para auditoría RGPD
  ip_hash      text,                             -- SHA256 del IP, NO el IP en claro
  unsubscribed_at timestamptz,                   -- null = activo; fecha = baja
  created_at   timestamptz not null default now()
);

create index if not exists newsletter_subscribers_created_at_idx
  on newsletter_subscribers (created_at desc);

create index if not exists newsletter_subscribers_active_idx
  on newsletter_subscribers (created_at desc)
  where unsubscribed_at is null;

-- RLS estricta: solo service_role puede leer/escribir.
-- El endpoint /api/newsletter/subscribe usa adminSupabase() con service role.
-- Anon nunca toca la tabla directamente — evita scraping del listado.
alter table newsletter_subscribers enable row level security;

comment on table newsletter_subscribers is
  'Suscriptores a la newsletter de TakaSports. RGPD: consent_at + source + user_agent + ip_hash para auditoría. unsubscribed_at marca bajas sin borrar (retención legal).';
