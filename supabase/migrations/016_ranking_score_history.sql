-- 016 — ranking_score_history
-- Snapshots semanales del Indice Taka por entrada (rank + score).
-- Permite el chart de 12 semanas en /rankings/[id].
-- NOTA: ranking_snapshots ya existe (sistema de learning, formato JSON
-- por categoria) — esta tabla es por-entry, mucho mas util para chart.

create table if not exists public.ranking_score_history (
  id            bigserial primary key,
  entry_id      text         not null,
  category      text         not null,
  captured_at   timestamptz  not null default now(),
  week_start    date         not null,
  rank          integer,
  score         numeric(5,2),
  unique (entry_id, category, week_start)
);

create index if not exists ranking_score_history_entry_idx
  on public.ranking_score_history (entry_id, category, week_start desc);

create index if not exists ranking_score_history_week_idx
  on public.ranking_score_history (week_start desc);

-- Helper: lunes 00:00 UTC de la semana actual
create or replace function public.f_current_iso_week_start()
returns date language sql immutable as $$
  select date_trunc('week', (now() at time zone 'UTC'))::date
$$;

-- Captura un snapshot del estado actual de ranking_view.
create or replace function public.f_capture_score_history()
returns integer language plpgsql as $$
declare
  v_week date := public.f_current_iso_week_start();
  v_rows integer := 0;
begin
  insert into public.ranking_score_history
    (entry_id, category, week_start, rank, score)
  select
    rv.id, rv.category, v_week, rv.rank, rv.score
  from public.ranking_view rv
  on conflict (entry_id, category, week_start) do update set
    rank        = excluded.rank,
    score       = excluded.score,
    captured_at = now();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Backfill: snapshot actual + previo (usando score_prev/rank_prev).
create or replace function public.f_backfill_score_history()
returns integer language plpgsql as $$
declare
  v_week_now  date := public.f_current_iso_week_start();
  v_week_prev date := v_week_now - interval '7 days';
  v_rows integer := 0;
begin
  perform public.f_capture_score_history();

  insert into public.ranking_score_history (entry_id, category, week_start, rank, score)
  select rv.id, rv.category, v_week_prev, rv.rank_prev, rv.score_prev
  from public.ranking_view rv
  where rv.score_prev is not null
  on conflict (entry_id, category, week_start) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

alter table public.ranking_score_history enable row level security;
drop policy if exists "ranking_score_history_read" on public.ranking_score_history;
create policy "ranking_score_history_read"
  on public.ranking_score_history for select using (true);

-- Uso:
--   select public.f_backfill_score_history();
-- En cada ingest semanal (WF-11/WF-12):
--   select public.f_capture_score_history();
