-- Chat de ligas privadas de quiniela
-- Tabla muy simple: mensajes de texto < 280 chars, asociados a una league_id
-- Usados por /api/quiniela/chat (web) y src/services/chat.ts (app)

create table if not exists public.quiniela_league_chat (
  id           uuid primary key default gen_random_uuid(),
  league_id    text not null,            -- referencia textual a quiniela_leagues.id
  user_id      uuid references auth.users(id) on delete set null,
  nickname     varchar(24) not null,
  message      varchar(280) not null,
  created_at   timestamptz not null default now()
);

-- Índice para listar mensajes por liga ordenados por fecha
create index if not exists quiniela_league_chat_league_id_created_at_idx
  on public.quiniela_league_chat (league_id, created_at desc);

-- Permitir realtime para los clientes que se subscriban
alter publication supabase_realtime add table public.quiniela_league_chat;

-- ── Row Level Security ──────────────────────────────────────────────
alter table public.quiniela_league_chat enable row level security;

-- Cualquier persona autenticada puede leer mensajes (las ligas son públicas
-- si conoces el código).
create policy "anyone can read chat"
  on public.quiniela_league_chat
  for select
  using (true);

-- Solo usuarios autenticados pueden insertar mensajes (y solo como ellos
-- mismos: el server inserta con auth.uid()).
create policy "authenticated can insert"
  on public.quiniela_league_chat
  for insert
  with check (
    -- O bien el user_id coincide con auth.uid(), o es null (server lo hace
    -- por nosotros si vienes sin auth — el server controla el rate limit).
    user_id is null or user_id = auth.uid()
  );

-- Nadie puede modificar/borrar mensajes ajenos
create policy "owner can delete own messages"
  on public.quiniela_league_chat
  for delete
  using (user_id = auth.uid());
