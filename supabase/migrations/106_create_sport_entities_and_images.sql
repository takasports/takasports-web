-- Fase 0.2 — Cimientos de datos deportivos.
--
-- Tres tablas:
--   1. sport_entities  — entidad canónica (jugador/equipo/liga) de CUALQUIER deporte,
--      con los IDs cruzados de cada fuente. Es el hub que desacopla la web de las APIs
--      externas (ESPN, api-sports) y permite servir desde Supabase en vez de depender
--      de la disponibilidad y las cuotas de terceros en cada request.
--   2. sport_entity_images — foto/escudo YA resuelto por la cascada de fuentes
--      (api-football -> ESPN -> Wikimedia -> placeholder), con su licencia y atribución.
--      Se resuelve en ingesta, no en render: los CDNs tienen rate limit por segundo y
--      DynamicImage no encadena fuentes. NO se llama entity_images porque ese nombre ya
--      lo ocupa la caché de imágenes editoriales de taka-system (otro esquema: keyed por
--      entity_name, con autor/handle/watermark para créditos de foto en artículos).
--   3. player_valuation_history — serie temporal de valor de mercado (solo fútbol),
--      ingerida del dataset CC0 davidcariboo/player-scores. El dato es TM-derivado:
--      la atribución a Transfermarkt + enlace al perfil (tm_profile_url) es OBLIGATORIA
--      en la UI, y el uso debe ser editorial por jugador, nunca un índice masivo.
--
-- RLS: lectura pública, escritura solo service_role (mismo patrón que past_events).

create table sport_entities (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('player','team','league')),
  sport        text not null,                       -- 'football','basketball','tennis',...
  name         text not null,
  slug         text unique,
  espn_id      text,
  apisports_id bigint,
  wikidata_id  text,
  tm_player_id bigint,                              -- puente a Transfermarkt (fútbol)
  market_value_eur        bigint,                   -- valor actual (denormalizado, solo fútbol)
  market_value_updated_at date,
  tm_profile_url          text,                     -- atribución + enlace obligatorios
  meta         jsonb not null default '{}'::jsonb,  -- extra por deporte (dorsal, posición…)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index sport_entities_type_sport_idx on sport_entities (type, sport);
create index sport_entities_apisports_idx  on sport_entities (apisports_id);
create index sport_entities_tm_idx         on sport_entities (tm_player_id);

create table sport_entity_images (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references sport_entities(id) on delete cascade,
  kind        text not null check (kind in ('headshot','cutout','logo','jersey')),
  url         text not null,
  source      text not null,                        -- 'api-football','espn','wikimedia',...
  license     text,
  attribution text,
  width       int,
  status      text not null default 'ok' check (status in ('ok','missing','pending')),
  checked_at  timestamptz not null default now(),
  unique (entity_id, kind)
);

create table player_valuation_history (
  tm_player_id     bigint not null,
  date             date not null,
  market_value_eur bigint,
  club_name        text,
  primary key (tm_player_id, date)
);

alter table sport_entities            enable row level security;
alter table sport_entity_images       enable row level security;
alter table player_valuation_history  enable row level security;
create policy "public read sport_entities"       on sport_entities           for select using (true);
create policy "public read sport_entity_images"  on sport_entity_images      for select using (true);
create policy "public read valuations"           on player_valuation_history for select using (true);
