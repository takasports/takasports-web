-- ─────────────────────────────────────────────────────────────────
-- TakaSports — Schema extendido para Quiniela
-- Ejecutar DESPUÉS de schema.sql en el SQL Editor de Supabase.
-- Idempotente: usa "if not exists" / "or replace" donde aplica.
-- ─────────────────────────────────────────────────────────────────

-- ── LEAGUES (privadas) ───────────────────────────────────────────
create table if not exists public.quiniela_leagues (
  id           text primary key,                       -- código de 6 chars en mayúsculas
  name         text not null,
  jornada      text not null,                          -- etiqueta humana (ej. "Champions · LaLiga")
  match_keys   jsonb not null default '[]'::jsonb,     -- [{home, away, isoDate, espnId?}]
  owner_id     uuid references auth.users on delete set null,
  created_at   timestamptz default now()
);

create index if not exists quiniela_leagues_owner on public.quiniela_leagues(owner_id);

-- ── LEAGUE MEMBERS (picks por usuario en cada liga) ──────────────
create table if not exists public.quiniela_league_members (
  league_id    text references public.quiniela_leagues(id) on delete cascade,
  user_id      uuid references auth.users on delete cascade,
  nickname     text not null,
  picks        jsonb not null default '{}'::jsonb,     -- { "<idx>": "1"|"X"|"2"|"1X"|"X2" }
  exact_scores jsonb default '{}'::jsonb,              -- { "<idx>": {home, away} }
  captain_idx  int,
  joined_at    timestamptz default now(),
  updated_at   timestamptz default now(),
  primary key (league_id, user_id)
);

create index if not exists qlm_user on public.quiniela_league_members(user_id);

-- ── SEASON PREDICTIONS (bonus questions de larga duración) ──────
-- Ej.: campeón LaLiga 2025/26, pichichi, equipo descenso, balón de oro.
create table if not exists public.quiniela_season_questions (
  id          text primary key,                          -- ej. "laliga_2025_26_champion"
  competition text not null,
  season      text not null,
  question    text not null,
  options     jsonb not null,                            -- [{value, label, logo?}]
  closes_at   timestamptz not null,                      -- normalmente jornada 1
  resolved    text,                                      -- valor ganador o null
  created_at  timestamptz default now()
);

create table if not exists public.quiniela_season_predictions (
  user_id      uuid references auth.users on delete cascade,
  question_id  text references public.quiniela_season_questions(id) on delete cascade,
  answer       text not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  primary key (user_id, question_id)
);

-- ── COIN LEDGER (audit trail server-side de monedas) ────────────
create table if not exists public.quiniela_coin_txns (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  amount     int not null,                              -- positivo o negativo
  reason     text not null,
  context    jsonb,                                     -- { jornada?, leagueId?, matchIdx? }
  created_at timestamptz default now()
);

create index if not exists qct_user_time on public.quiniela_coin_txns(user_id, created_at desc);

-- ── BADGES (logros) ──────────────────────────────────────────────
create table if not exists public.quiniela_badges (
  user_id      uuid references auth.users on delete cascade,
  badge_id     text not null,
  unlocked_at  timestamptz default now(),
  primary key (user_id, badge_id)
);

-- ── PUSH SUBSCRIPTIONS ───────────────────────────────────────────
create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid references auth.users on delete set null,
  p256dh      text not null,
  auth        text not null,
  topics      text[] default array['quiniela'],
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists push_subs_user on public.push_subscriptions(user_id);

-- ── LEAGUE CHAT ──────────────────────────────────────────────────
create table if not exists public.quiniela_league_chat (
  id          uuid default gen_random_uuid() primary key,
  league_id   text references public.quiniela_leagues(id) on delete cascade,
  user_id     uuid references auth.users on delete set null,
  nickname    text not null,
  message     text not null check (char_length(message) <= 280),
  created_at  timestamptz default now()
);

create index if not exists qlc_league_time on public.quiniela_league_chat(league_id, created_at desc);

alter table public.quiniela_league_chat enable row level security;
drop policy if exists "chat_read"   on public.quiniela_league_chat;
drop policy if exists "chat_insert" on public.quiniela_league_chat;
create policy "chat_read"   on public.quiniela_league_chat for select using (true);
create policy "chat_insert" on public.quiniela_league_chat for insert
  with check (auth.uid() = user_id or user_id is null);

-- ── MATCH RESULTS CACHE (snapshot oficial server-side) ──────────
-- Permite cierres deterministas y scoring reproducible aun si ESPN cambia historial.
create table if not exists public.quiniela_match_results (
  espn_id      text primary key,
  home         text not null,
  away         text not null,
  home_goals   int not null,
  away_goals   int not null,
  outcome      text not null check (outcome in ('1','X','2')),
  finalized_at timestamptz default now()
);

-- ─── Row Level Security ──────────────────────────────────────────
alter table public.quiniela_leagues             enable row level security;
alter table public.quiniela_league_members      enable row level security;
alter table public.quiniela_season_questions    enable row level security;
alter table public.quiniela_season_predictions  enable row level security;
alter table public.quiniela_coin_txns           enable row level security;
alter table public.quiniela_badges              enable row level security;
alter table public.push_subscriptions           enable row level security;
alter table public.quiniela_match_results       enable row level security;

-- Leagues: cualquiera autenticado puede leer (para unirse vía code), solo owner puede borrar
drop policy if exists "leagues_read"   on public.quiniela_leagues;
drop policy if exists "leagues_insert" on public.quiniela_leagues;
drop policy if exists "leagues_delete" on public.quiniela_leagues;
create policy "leagues_read"   on public.quiniela_leagues for select using (true);
create policy "leagues_insert" on public.quiniela_leagues for insert with check (auth.uid() = owner_id);
create policy "leagues_delete" on public.quiniela_leagues for delete using (auth.uid() = owner_id);

-- League members: leer todos los miembros de una liga si eres miembro o si la liga es pública;
-- escribir solo tus propios picks
drop policy if exists "lm_read"   on public.quiniela_league_members;
drop policy if exists "lm_upsert" on public.quiniela_league_members;
drop policy if exists "lm_delete" on public.quiniela_league_members;
create policy "lm_read"   on public.quiniela_league_members for select using (true);
create policy "lm_upsert" on public.quiniela_league_members for insert with check (auth.uid() = user_id);
create policy "lm_update" on public.quiniela_league_members for update using (auth.uid() = user_id);
create policy "lm_delete" on public.quiniela_league_members for delete using (auth.uid() = user_id);

-- Season questions: lectura pública, escritura solo service role
drop policy if exists "sq_read" on public.quiniela_season_questions;
create policy "sq_read" on public.quiniela_season_questions for select using (true);

-- Season predictions: solo el usuario
drop policy if exists "sp_self" on public.quiniela_season_predictions;
create policy "sp_self" on public.quiniela_season_predictions for all using (auth.uid() = user_id);

-- Coin txns: solo el usuario lee; escritura solo service role (vía RPC) — sin policy de write
drop policy if exists "qct_read" on public.quiniela_coin_txns;
create policy "qct_read" on public.quiniela_coin_txns for select using (auth.uid() = user_id);

-- Badges: solo el usuario lee; escritura solo service role
drop policy if exists "qb_read" on public.quiniela_badges;
create policy "qb_read" on public.quiniela_badges for select using (auth.uid() = user_id);

-- Push: solo el dueño de la suscripción
drop policy if exists "psub_self" on public.push_subscriptions;
create policy "psub_self" on public.push_subscriptions
  for all using (auth.uid() = user_id or user_id is null);

-- Match results: lectura pública (resultados son datos públicos)
drop policy if exists "qmr_read" on public.quiniela_match_results;
create policy "qmr_read" on public.quiniela_match_results for select using (true);

-- ── Triggers de updated_at ───────────────────────────────────────
drop trigger if exists qlm_updated_at on public.quiniela_league_members;
create trigger qlm_updated_at
  before update on public.quiniela_league_members
  for each row execute procedure public.handle_updated_at();

drop trigger if exists psub_updated_at on public.push_subscriptions;
create trigger psub_updated_at
  before update on public.push_subscriptions
  for each row execute procedure public.handle_updated_at();

drop trigger if exists sp_updated_at on public.quiniela_season_predictions;
create trigger sp_updated_at
  before update on public.quiniela_season_predictions
  for each row execute procedure public.handle_updated_at();

-- ── RPC: añadir monedas con audit (anti-cheat) ──────────────────
-- El cliente NUNCA escribe a la tabla directamente; llama a esta función
-- que valida y registra. Para anti-cheat real, esta función debería
-- verificar el resultado server-side; por ahora es un wrapper de auditoría.
create or replace function public.add_coins(p_amount int, p_reason text, p_context jsonb default '{}'::jsonb)
returns int
language plpgsql security definer as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_amount = 0 then return 0; end if;
  -- Cap absoluto por transacción para evitar abusos por bug de cliente
  if abs(p_amount) > 500 then raise exception 'amount out of range'; end if;
  insert into public.quiniela_coin_txns(user_id, amount, reason, context)
  values (uid, p_amount, p_reason, coalesce(p_context, '{}'::jsonb));
  return p_amount;
end;
$$;

revoke all on function public.add_coins(int, text, jsonb) from public;
grant execute on function public.add_coins(int, text, jsonb) to authenticated;

-- ── Vista: balance de monedas por usuario ────────────────────────
create or replace view public.quiniela_coin_balance as
select user_id, coalesce(sum(amount), 0)::int as balance
from public.quiniela_coin_txns
group by user_id;

grant select on public.quiniela_coin_balance to authenticated;
