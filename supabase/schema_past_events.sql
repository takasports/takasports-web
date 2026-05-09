-- Histórico de resultados deportivos (calendario · pestaña Resultados).
-- Crece sin coste por upsert diario desde ESPN (cron n8n o /api/cron/sync-past-results).

create table if not exists public.past_events (
  id           text primary key,                 -- mismo id que SportEvent.id
  iso_date     timestamptz not null,             -- inicio del evento (UTC)
  sport        text not null,                    -- 'Fútbol', 'NBA', 'F1', 'UFC', 'Tenis'…
  comp         text not null,                    -- 'LaLiga', 'Premier'…
  home         text not null,
  away         text,                             -- null en deportes individuales
  home_score   integer,
  away_score   integer,
  home_logo    text,
  away_logo    text,
  home_abbr    text,
  away_abbr    text,
  venue        text,
  match_ref    text,                             -- "{sport}_{league}_{espnId}"
  accent       text,                             -- color tema
  source       text not null default 'espn',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists past_events_iso_date_idx     on public.past_events (iso_date desc);
create index if not exists past_events_sport_date_idx   on public.past_events (sport, iso_date desc);
create index if not exists past_events_comp_date_idx    on public.past_events (comp, iso_date desc);
create index if not exists past_events_match_ref_idx    on public.past_events (match_ref);

-- Búsqueda full-text simple por equipos + competición (español, sin acentos).
create index if not exists past_events_search_idx on public.past_events
  using gin (to_tsvector('simple', unaccent(coalesce(home,'') || ' ' || coalesce(away,'') || ' ' || coalesce(comp,''))));

-- Para que la extensión `unaccent` exista (ejecutar una sola vez):
-- create extension if not exists unaccent;

-- RLS: lectura pública, escritura solo service role.
alter table public.past_events enable row level security;

drop policy if exists past_events_read on public.past_events;
create policy past_events_read on public.past_events for select using (true);

drop policy if exists past_events_write on public.past_events;
create policy past_events_write on public.past_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
