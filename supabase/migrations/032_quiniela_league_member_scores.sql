-- ─────────────────────────────────────────────────────────────────
-- 032 — Persistencia de scores reales por miembro de liga privada
--
-- Antes: /api/quiniela/leaderboard devolvía pickCount como proxy del
-- score real, porque no había score persistido por miembro/jornada
-- (comentario explícito en route.ts admitiéndolo). Eso significa que
-- el ranking estaba ordenado por «cuántos picks rellenaste», no por
-- aciertos. Bug de credibilidad.
--
-- Esta migración añade la tabla donde se persisten los scores
-- calculados por el server (lib/quiniela-server.ts → persistLeagueScores).
-- El cliente sigue calculando standings en vivo (computeStandings) y
-- mostrándolas en LeagueExpanded — esa lógica no se toca.
--
-- IMPORTANTE — qué NO toca esta migración:
--   · No modifica quiniela_leagues, quiniela_league_members,
--     quiniela_picks, quiniela_coin_txns, quiniela_badges, chat,
--     match_results, odds_cache.
--   · No cambia ninguna RPC existente (add_coins, record_game_play).
--   · No introduce dependencias cíclicas: la tabla referencia ligas
--     y auth.users con ON DELETE CASCADE (consistente con el resto).
--
-- Aplicar en: Supabase Dashboard → SQL Editor.
-- Idempotente: usa "if not exists" / "or replace" donde aplica.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.quiniela_league_member_scores (
  league_id    text         not null references public.quiniela_leagues(id) on delete cascade,
  user_id      uuid         not null references auth.users           on delete cascade,
  jornada      text         not null,
  points       numeric(10,2) not null default 0,
  hits         int          not null default 0,
  exacts       int          not null default 0,
  pleno        boolean      not null default false,
  computed_at  timestamptz  not null default now(),
  primary key (league_id, user_id, jornada)
);

-- Índice para el ordenamiento típico del leaderboard por jornada.
create index if not exists qlms_league_jornada_pts
  on public.quiniela_league_member_scores (league_id, jornada, points desc);

-- Índice para historiales por usuario (campeonato acumulado futuro).
create index if not exists qlms_user_time
  on public.quiniela_league_member_scores (user_id, computed_at desc);

-- ── RLS ─────────────────────────────────────────────────────────
-- Lectura pública (consistente con quiniela_league_members.lm_read):
-- el ranking de una liga debe ser visible a invitados con el código.
-- Escritura SOLO via service_role (no policy de insert/update/delete).
alter table public.quiniela_league_member_scores enable row level security;

drop policy if exists "qlms_read" on public.quiniela_league_member_scores;
create policy "qlms_read"
  on public.quiniela_league_member_scores
  for select using (true);

-- ─────────────────────────────────────────────────────────────────
-- Verificación tras aplicar:
--   select * from public.quiniela_league_member_scores limit 1;
--   \d+ public.quiniela_league_member_scores
-- ─────────────────────────────────────────────────────────────────
