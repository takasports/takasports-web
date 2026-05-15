-- ─────────────────────────────────────────────────────────────────
-- 018 — Games scoring agregado (cross-game)
--
-- Objetivo: una sola fuente de verdad de partidas / puntos / racha
-- para los 5 juegos de /juegos (quiniela, crackquiz, mionce,
-- sopacracks, takagrid) + futuros.
--
-- IMPORTANTE — qué NO toca esta migración:
--   · No modifica quiniela_* (leagues, picks, members, coin_txns,
--     match_results, badges, chat). Quiniela conserva su scoring
--     interno; al cerrar jornada el cron/route hará UPSERT en
--     game_plays como AGREGADO para el ranking global.
--   · No modifica profiles, reminders, read_history, rankings_*.
--
-- Aplicar en: Supabase Dashboard → SQL Editor.
-- Idempotente: usa "if not exists" / "or replace" donde aplica.
-- ─────────────────────────────────────────────────────────────────

-- ── GAME_PLAYS ───────────────────────────────────────────────────
-- Una fila por (usuario × juego × periodo). El "periodo" es texto
-- libre que cada juego elige: "2026-W20" (semanal), "2026-05-15"
-- (diario), "2026-J38" (jornada). Coherente con el resto del repo.
create table if not exists public.game_plays (
  id          uuid         default gen_random_uuid() primary key,
  user_id     uuid         references auth.users on delete cascade not null,
  game_id     text         not null check (
                game_id in ('quiniela','crackquiz','mionce','sopacracks','takagrid','strikerrush')
              ),
  period      text         not null,
  score       int          not null default 0,
  payload     jsonb        not null default '{}'::jsonb,
  duration_ms int,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  unique (user_id, game_id, period)
);

create index if not exists game_plays_leaderboard_idx
  on public.game_plays (game_id, period, score desc);

create index if not exists game_plays_user_idx
  on public.game_plays (user_id, created_at desc);

-- ── GAME_STREAKS ─────────────────────────────────────────────────
-- Racha diaria global (cualquier juego cuenta). Una fila por usuario.
create table if not exists public.game_streaks (
  user_id           uuid        references auth.users on delete cascade primary key,
  current_streak    int         not null default 0,
  best_streak       int         not null default 0,
  last_played_date  date,
  total_plays       int         not null default 0,
  updated_at        timestamptz not null default now()
);

-- ── GAME_CONTENT (Fase 6 — preparado pero sin uso aún) ──────────
-- Contenido publicado por admin/cron para alimentar cada juego sin
-- redeploy. Lectura pública, escritura solo service_role.
create table if not exists public.game_content (
  game_id     text         not null,
  period      text         not null,
  payload     jsonb        not null,
  status      text         not null default 'draft' check (status in ('draft','published')),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  primary key (game_id, period)
);

create index if not exists game_content_pub_idx
  on public.game_content (game_id, status, period desc);

-- ─── Row Level Security ──────────────────────────────────────────
alter table public.game_plays    enable row level security;
alter table public.game_streaks  enable row level security;
alter table public.game_content  enable row level security;

-- game_plays: lectura pública (para leaderboards), escritura solo
-- vía RPC record_game_play (security definer). Sin policy de insert
-- => el cliente no puede insertar directamente.
drop policy if exists "gp_read" on public.game_plays;
create policy "gp_read" on public.game_plays for select using (true);

-- game_streaks: lectura pública (para mostrar streak en perfil),
-- escritura vía RPC ping_game_streak.
drop policy if exists "gs_read" on public.game_streaks;
create policy "gs_read" on public.game_streaks for select using (true);

-- game_content: lectura solo de publicados, escritura service_role.
drop policy if exists "gc_read" on public.game_content;
create policy "gc_read" on public.game_content
  for select using (status = 'published');

-- ── Triggers de updated_at ───────────────────────────────────────
drop trigger if exists game_plays_updated_at on public.game_plays;
create trigger game_plays_updated_at
  before update on public.game_plays
  for each row execute procedure public.handle_updated_at();

drop trigger if exists game_streaks_updated_at on public.game_streaks;
create trigger game_streaks_updated_at
  before update on public.game_streaks
  for each row execute procedure public.handle_updated_at();

drop trigger if exists game_content_updated_at on public.game_content;
create trigger game_content_updated_at
  before update on public.game_content
  for each row execute procedure public.handle_updated_at();

-- ── RPC: record_game_play (anti-cheat wrapper) ──────────────────
-- Mismo patrón que add_coins(): security definer + cap absoluto.
-- El cap (10_000) es defensivo; ajustable. UPSERT por
-- (user_id, game_id, period): la mejor puntuación gana.
create or replace function public.record_game_play(
  p_game_id     text,
  p_period      text,
  p_score       int,
  p_payload     jsonb default '{}'::jsonb,
  p_duration_ms int   default null
)
returns public.game_plays
language plpgsql security definer as $$
declare
  uid uuid := auth.uid();
  row public.game_plays;
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_game_id is null or p_period is null then
    raise exception 'game_id and period required';
  end if;
  if p_game_id not in ('quiniela','crackquiz','mionce','sopacracks','takagrid','strikerrush') then
    raise exception 'unknown game_id %', p_game_id;
  end if;
  if p_score < 0 or p_score > 10000 then
    raise exception 'score out of range';
  end if;

  insert into public.game_plays (user_id, game_id, period, score, payload, duration_ms)
  values (uid, p_game_id, p_period, p_score, coalesce(p_payload, '{}'::jsonb), p_duration_ms)
  on conflict (user_id, game_id, period) do update
    set score       = greatest(public.game_plays.score, excluded.score),
        payload     = excluded.payload,
        duration_ms = coalesce(excluded.duration_ms, public.game_plays.duration_ms),
        updated_at  = now()
  returning * into row;

  return row;
end;
$$;

revoke all on function public.record_game_play(text, text, int, jsonb, int) from public;
grant execute on function public.record_game_play(text, text, int, jsonb, int) to authenticated;

-- ── RPC: ping_game_streak ────────────────────────────────────────
-- Llamar al completar cualquier partida. Lógica:
--   · si last_played_date = hoy        → no cambia streak, +1 total_plays
--   · si last_played_date = ayer       → streak +1, best = max(best, streak)
--   · si last_played_date < ayer o null→ streak = 1
create or replace function public.ping_game_streak()
returns public.game_streaks
language plpgsql security definer as $$
declare
  uid    uuid := auth.uid();
  today  date := current_date;
  row    public.game_streaks;
  prev   public.game_streaks;
  new_streak int;
begin
  if uid is null then raise exception 'auth required'; end if;

  select * into prev from public.game_streaks where user_id = uid;

  if prev.user_id is null then
    insert into public.game_streaks (user_id, current_streak, best_streak, last_played_date, total_plays)
    values (uid, 1, 1, today, 1)
    returning * into row;
    return row;
  end if;

  if prev.last_played_date = today then
    new_streak := prev.current_streak;
  elsif prev.last_played_date = today - 1 then
    new_streak := prev.current_streak + 1;
  else
    new_streak := 1;
  end if;

  update public.game_streaks
    set current_streak   = new_streak,
        best_streak      = greatest(prev.best_streak, new_streak),
        last_played_date = today,
        total_plays      = prev.total_plays + 1,
        updated_at       = now()
    where user_id = uid
  returning * into row;

  return row;
end;
$$;

revoke all on function public.ping_game_streak() from public;
grant execute on function public.ping_game_streak() to authenticated;

-- ── Vista: leaderboard por juego + periodo con display_name ─────
create or replace view public.v_game_leaderboard as
select
  gp.game_id,
  gp.period,
  gp.user_id,
  gp.score,
  gp.duration_ms,
  gp.created_at,
  p.display_name,
  p.avatar_url,
  rank() over (partition by gp.game_id, gp.period order by gp.score desc, gp.duration_ms asc nulls last, gp.created_at asc) as position
from public.game_plays gp
left join public.profiles p on p.id = gp.user_id;

grant select on public.v_game_leaderboard to anon, authenticated;

-- ── Vista: ranking global cross-game (semana actual ISO) ────────
-- Suma de puntos por usuario en TODOS los juegos durante la semana
-- ISO actual. Se materializa lazy en cada query (sin cron).
create or replace view public.v_game_global_week as
select
  gp.user_id,
  p.display_name,
  p.avatar_url,
  sum(gp.score)::int as total_score,
  count(*)::int      as plays,
  rank() over (order by sum(gp.score) desc) as position
from public.game_plays gp
left join public.profiles p on p.id = gp.user_id
where to_char(gp.created_at, 'IYYY-"W"IW') = to_char(now(), 'IYYY-"W"IW')
group by gp.user_id, p.display_name, p.avatar_url;

grant select on public.v_game_global_week to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- FIN 018. Verificación rápida tras aplicar:
--   select * from public.game_plays    limit 1;
--   select * from public.game_streaks  limit 1;
--   select * from public.game_content  limit 1;
--   select * from public.v_game_leaderboard limit 1;
-- ─────────────────────────────────────────────────────────────────
