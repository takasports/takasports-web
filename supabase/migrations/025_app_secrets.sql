-- Almacén privado de secretos rotables (p.ej. el token largo de Instagram).
-- RLS activado SIN políticas: solo el service_role (que salta RLS) puede
-- leer/escribir. El anon/auth key NO tiene acceso. No exponer nunca por
-- PostgREST con clave pública.

create table if not exists app_secrets (
  key         text primary key,
  value       text        not null,
  expires_at  timestamptz,
  updated_at  timestamptz not null default now()
);

alter table app_secrets enable row level security;

-- Sin policies a propósito → acceso exclusivo vía SUPABASE_SERVICE_ROLE_KEY.

comment on table app_secrets is
  'Secretos rotables server-side. Acceso solo con service_role. Ej: ig_access_token (token largo IG, auto-refrescado por WF-10).';
