-- 102_create_push_tokens_table.sql
-- Tokens de push EXPO de la app nativa (distinto de push_subscriptions = Web Push
-- VAPID). El backend (n8n) enviará leyendo esta tabla con service_role; el cliente
-- (app) registra/actualiza su token y lo borra al cerrar sesión.
--
-- Ya aplicada en producción vía MCP (migración `create_push_tokens_table`,
-- 2026-07-11); este fichero la versiona en el repo. Idempotente.

create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  platform    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Cada usuario gestiona SOLO sus propios tokens; el backend usa service_role (salta RLS).
drop policy if exists "ptok_self" on public.push_tokens;
create policy "ptok_self" on public.push_tokens
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
