-- Fase 0 (extra) — Serie temporal semanal del RENDIMIENTO crudo de cada jugador.
--
-- Guardamos los INGREDIENTES (estadísticas), NO un "Valor Taka" calculado: el modelo de
-- valor todavía no existe. Capturando cada semana las variables con las que se calculará,
-- el día que el modelo exista lo aplicamos hacia atrás sobre todo el histórico y la curva
-- de valor aparece completa desde el primer snapshot — no arranca en cero. Y aunque el
-- modelo nunca llegue, esto ya habilita los gráficos de evolución de estadísticas que pide
-- el roadmap de EstadisticasClient. Apuesta sin downside.
--
-- Mismo patrón que ranking_score_history (migración 016): semanal, append-only, idempotente
-- por (entidad, semana). La columna stats va como JSONB a propósito: aún no sabemos qué
-- variables usará el modelo, así que guardamos TODO lo numérico que da ESPN sin filtrar.

create table player_stat_snapshots (
  id          bigserial primary key,
  entity_id   uuid not null references sport_entities(id) on delete cascade,
  week_start  date not null,
  captured_at timestamptz not null default now(),
  season      text,
  club        text,
  stats       jsonb not null default '{}'::jsonb,   -- { minutes, totalGoals, goalAssists, ... } crudos de ESPN
  unique (entity_id, week_start)
);
create index player_stat_snapshots_entity_idx on player_stat_snapshots (entity_id, week_start desc);
create index player_stat_snapshots_week_idx   on player_stat_snapshots (week_start desc);

alter table player_stat_snapshots enable row level security;
create policy "public read player_stat_snapshots" on player_stat_snapshots for select using (true);
