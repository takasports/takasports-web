-- Reportes de mensajes del chat de ligas. Google Play exige poder reportar en todo
-- contenido de usuarios; el chat no lo tenía (los comentarios sí, migración 036).
-- Con 3 reportes de personas distintas el mensaje deja de servirse.
alter table public.quiniela_league_chat
  add column if not exists flagged_count integer not null default 0;

create table if not exists public.quiniela_league_chat_reports (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.quiniela_league_chat(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create index if not exists quiniela_league_chat_reports_message_idx
  on public.quiniela_league_chat_reports (message_id);

-- Solo el servidor (service role) lee y escribe: sin políticas para clientes.
alter table public.quiniela_league_chat_reports enable row level security;
