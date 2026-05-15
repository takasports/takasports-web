-- ─────────────────────────────────────────────────────────────────
-- 016 — ranking_snapshots
-- Snapshots semanales del Índice Taka por entrada.
-- Permite dibujar histórico (sparkline + chart 12 semanas en /rankings/[id]).
-- Aplicar en: Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.ranking_snapshots (
  id              bigserial primary key,
  entry_id        text        not null,
  category        text        not null,
  captured_at     timestamptz not null default now(),
  -- Semana ISO (lunes 00:00 UTC) — facilita upsert idempotente por semana
  week_start      date        not null,
  rank            integer,
  score           numeric(5,2),
  score_sport     numeric(5,2),
  rendimiento     numeric(5,2),
  contexto        numeric(5,2),
  mediatico       numeric(5,2),
  narrativa       numeric(5,2),
  editorial_boost numeric(5,2),
  unique (entry_id, category, week_start)
);

create index if not exists ranking_snapshots_entry_idx
  on public.ranking_snapshots (entry_id, category, week_start desc);

create index if not exists ranking_snapshots_week_idx
  on public.ranking_snapshots (week_start desc);

-- Helper: lunes (00:00) UTC de la semana actual
create or replace function public.f_current_iso_week_start()
returns date language sql immutable as $$
  select date_trunc('week', (now() at time zone 'UTC'))::date
$$;

-- Captura un snapshot del estado actual de ranking_view.
-- Idempotente por (entry_id, category, week_start): si ya existe se actualiza.
-- Pensado para llamarlo justo antes/después de cada ingest semanal.
create or replace function public.f_capture_ranking_snapshot()
returns integer language plpgsql as $$
declare
  v_week date := public.f_current_iso_week_start();
  v_rows integer := 0;
begin
  insert into public.ranking_snapshots
    (entry_id, category, week_start, rank, score, score_sport,
     rendimiento, contexto, mediatico, narrativa, editorial_boost)
  select
    rv.id,
    rv.category,
    v_week,
    rv.rank,
    rv.score,
    rv.score_sport,
    rv.rendimiento,
    rv.contexto,
    rv.mediatico,
    rv.narrativa,
    rv.editorial_boost
  from public.ranking_view rv
  where rv.active is true or rv.active is null
  on conflict (entry_id, category, week_start) do update set
    rank            = excluded.rank,
    score           = excluded.score,
    score_sport     = excluded.score_sport,
    rendimiento     = excluded.rendimiento,
    contexto        = excluded.contexto,
    mediatico       = excluded.mediatico,
    narrativa       = excluded.narrativa,
    editorial_boost = excluded.editorial_boost,
    captured_at     = now();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Backfill inicial: usa el estado actual + score_prev (si existe en ranking_view)
-- para que el histórico arranque con al menos 2 puntos por entrada.
-- Ejecutar UNA vez tras aplicar la migración.
create or replace function public.f_backfill_ranking_snapshots()
returns integer language plpgsql as $$
declare
  v_week_now  date := public.f_current_iso_week_start();
  v_week_prev date := v_week_now - interval '7 days';
  v_rows integer := 0;
begin
  -- Snapshot "actual"
  perform public.f_capture_ranking_snapshot();

  -- Snapshot "semana anterior" desde score_prev (si la columna existe en la vista)
  insert into public.ranking_snapshots (entry_id, category, week_start, rank, score)
  select
    rv.id, rv.category, v_week_prev, rv.rank, rv.score_prev
  from public.ranking_view rv
  where rv.score_prev is not null
  on conflict (entry_id, category, week_start) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- ── RLS — lectura pública, escritura solo service_role ───────────
alter table public.ranking_snapshots enable row level security;

drop policy if exists "ranking_snapshots_read" on public.ranking_snapshots;
create policy "ranking_snapshots_read"
  on public.ranking_snapshots for select using (true);

-- Las writes solo via service_role (sin policy explícita).

-- ── Uso ─────────────────────────────────────────────────────────
-- 1) Aplicar este SQL.
-- 2) Backfill UNA VEZ:
--      select public.f_backfill_ranking_snapshots();
-- 3) Después de cada ingest semanal (WF-11/WF-12 en n8n) añadir:
--      select public.f_capture_ranking_snapshot();
