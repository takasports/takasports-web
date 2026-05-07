-- ─────────────────────────────────────────────────────────────────
-- TakaSports — Supabase Schema
-- Run this in the Supabase SQL Editor (supabase.com → SQL Editor)
-- ─────────────────────────────────────────────────────────────────

-- PROFILES (extends auth.users)
create table if not exists public.profiles (
  id           uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url   text,
  timezone     text default 'Europe/Madrid',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- QUINIELA PICKS
create table if not exists public.quiniela_picks (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  jornada    text not null,
  picks      jsonb not null,
  created_at timestamptz default now()
);

-- REMINDERS
create table if not exists public.reminders (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  event_id    text not null,
  event_data  jsonb not null,
  created_at  timestamptz default now(),
  unique (user_id, event_id)
);

-- READ HISTORY
create table if not exists public.read_history (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users on delete cascade not null,
  slug         text not null,
  title        text,
  sport        text,
  category     text,
  published_at timestamptz,
  image_url    text,
  read_at      timestamptz default now(),
  unique (user_id, slug)
);

-- ─── Row Level Security ──────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.quiniela_picks enable row level security;
alter table public.reminders      enable row level security;
alter table public.read_history   enable row level security;

-- Profiles: only the user can read/write their own row
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id);

-- Quiniela picks
create policy "quiniela_self" on public.quiniela_picks
  for all using (auth.uid() = user_id);

-- Reminders
create policy "reminders_self" on public.reminders
  for all using (auth.uid() = user_id);

-- Read history
create policy "read_history_self" on public.read_history
  for all using (auth.uid() = user_id);

-- ─── Auto-update updated_at on profiles ─────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();
