-- ─────────────────────────────────────────────────────────────────
-- 019 — Game events (telemetría)
--
-- Funnel por juego: started -> completed (-> shared). Permite medir
-- completion rate, retención y qué juegos generan más shares.
-- Aplicar en: Supabase Dashboard -> SQL Editor.
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.game_events (
  id          bigserial   primary key,
  user_id     uuid        references auth.users on delete set null,
  game_id     text        not null check (
                game_id in ('quiniela','crackquiz','mionce','sopacracks','takagrid','strikerrush')
              ),
  event_type  text        not null check (
                event_type in ('started','completed','abandoned','shared','leaderboard_view')
              ),
  period      text,
  meta        jsonb       not null default '{}'::jsonb,
  -- Identificador anónimo de sesión (no PII). Cliente envía un uuid
  -- de localStorage; permite contar usuarios anónimos únicos sin
  -- registrarse.
  anon_id     text,
  ts          timestamptz not null default now()
);

create index if not exists game_events_funnel_idx
  on public.game_events (game_id, event_type, ts desc);

create index if not exists game_events_user_idx
  on public.game_events (user_id, ts desc)
  where user_id is not null;

create index if not exists game_events_day_idx
  on public.game_events (ts);

-- ── RLS ──────────────────────────────────────────────────────────
-- Insert: público (anon o auth) — necesitamos tracking de invitados.
-- Lectura: solo service_role (los eventos son sensibles).
alter table public.game_events enable row level security;

drop policy if exists "ge_insert_any" on public.game_events;
create policy "ge_insert_any" on public.game_events
  for insert with check (
    -- Si user_id viene, debe coincidir con la sesión actual.
    user_id is null or user_id = auth.uid()
  );

-- Sin policy de SELECT => solo service_role puede leer.

-- ── Vista: funnel agregado por juego × día ──────────────────────
-- Cuenta eventos del último mes. La consulta es ligera con el index
-- (event_type, ts desc).
create or replace view public.v_game_funnel_30d as
with base as (
  select
    game_id,
    date_trunc('day', ts) as day,
    event_type,
    count(*)::int as n,
    count(distinct coalesce(user_id::text, anon_id))::int as unique_actors
  from public.game_events
  where ts >= now() - interval '30 days'
  group by 1,2,3
)
select
  game_id,
  day,
  sum(case when event_type = 'started'         then n             else 0 end)::int as started,
  sum(case when event_type = 'completed'       then n             else 0 end)::int as completed,
  sum(case when event_type = 'abandoned'       then n             else 0 end)::int as abandoned,
  sum(case when event_type = 'shared'          then n             else 0 end)::int as shared,
  sum(case when event_type = 'leaderboard_view'then n             else 0 end)::int as lb_views,
  sum(case when event_type = 'started'         then unique_actors else 0 end)::int as unique_starters
from base
group by game_id, day
order by day desc, game_id;

grant select on public.v_game_funnel_30d to authenticated;

-- ── Vista: resumen 7 días por juego ─────────────────────────────
create or replace view public.v_game_funnel_7d_summary as
select
  game_id,
  sum(started)::int           as started,
  sum(completed)::int         as completed,
  sum(shared)::int            as shared,
  sum(unique_starters)::int   as unique_starters,
  case when sum(started) > 0
       then round(sum(completed)::numeric / sum(started)::numeric * 100, 1)
       else 0 end             as completion_rate
from public.v_game_funnel_30d
where day >= current_date - 7
group by game_id
order by started desc;

grant select on public.v_game_funnel_7d_summary to authenticated;
