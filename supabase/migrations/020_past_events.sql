-- -----------------------------------------------------------------
-- 020 - past_events (calendario - pestaña Resultados)
--
-- Aplica el schema previo de supabase/schema_past_events.sql pero
-- corrigiendo el problema "functions in index expression must be marked
-- IMMUTABLE" con la función unaccent(). Solución: extensión + wrapper
-- IMMUTABLE explícito.
--
-- Idempotente. Aplicar en: Supabase Dashboard - SQL Editor.
-- -----------------------------------------------------------------

-- 1) Extensión unaccent (este proyecto ya la tiene instalada en
--    schema `public` por una migración previa). Si no existiera, este
--    statement la crearía donde corresponde según search_path.
create extension if not exists unaccent;

-- 2) Wrapper IMMUTABLE alrededor de unaccent($1).
--    `unaccent(text)` per se es STABLE — Postgres no lo acepta en index
--    expressions. El wrapper marcado IMMUTABLE soluciona el problema.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select public.unaccent($1)
$$;

-- 3) Tabla past_events.
create table if not exists public.past_events (
  id           text primary key,
  iso_date     timestamptz not null,
  sport        text not null,
  comp         text not null,
  home         text not null,
  away         text,
  home_score   integer,
  away_score   integer,
  home_logo    text,
  away_logo    text,
  home_abbr    text,
  away_abbr    text,
  venue        text,
  match_ref    text,
  accent       text,
  source       text not null default 'espn',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists past_events_iso_date_idx     on public.past_events (iso_date desc);
create index if not exists past_events_sport_date_idx   on public.past_events (sport, iso_date desc);
create index if not exists past_events_comp_date_idx    on public.past_events (comp, iso_date desc);
create index if not exists past_events_match_ref_idx    on public.past_events (match_ref);

-- 4) Index full-text usando el wrapper IMMUTABLE.
create index if not exists past_events_search_idx on public.past_events
  using gin (to_tsvector('simple',
    public.f_unaccent(coalesce(home,'') || ' ' || coalesce(away,'') || ' ' || coalesce(comp,''))
  ));

-- 5) RLS: lectura pública, escritura solo service role.
alter table public.past_events enable row level security;

drop policy if exists past_events_read  on public.past_events;
drop policy if exists past_events_write on public.past_events;

create policy past_events_read on public.past_events for select using (true);

create policy past_events_write on public.past_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Verificación post-apply:
--   select count(*) from public.past_events;
--   select indexdef from pg_indexes where indexname = 'past_events_search_idx';
