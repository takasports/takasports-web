-- ─────────────────────────────────────────────────────────────────
-- 034 — Goleador del partido destacado (Quiniela Ranked)
--
-- Por cada jornada de la Quiniela Ranked existe UN partido destacado
-- (el de mayor matchScore — calidad de competición × incertidumbre de
-- cuota). El usuario puede predecir quién marcará en ese partido sin
-- coste: si el jugador elegido marca 1 gol gana 100 monedas, 2 → 200,
-- 3+ → 350. Si no marca, no pierde nada (es bonus).
--
-- Las predicciones y la resolución son automáticas:
--   · Candidatos = roster ESPN del partido (mismos IDs que los
--     scorers que llegan en keyEvents → matcheo perfecto).
--   · Resolución = lazy cuando alguien carga GET /api/quiniela/featured
--     tras el partido en estado FINAL.
--   · Acreditación = vía RPC add_coins existente con context.source
--     = 'featured_goalscorer' (mismo wallet único: quiniela_coin_txns).
--
-- IMPORTANTE — qué NO toca esta migración:
--   · No modifica add_coins, award_game_coins, record_game_play.
--   · No modifica quiniela_picks, quiniela_leagues, quiniela_coin_txns,
--     quiniela_match_results.
--   · No requiere RPC nueva: la inserción de coins reusa add_coins.
--
-- Aplicar en: Supabase Dashboard → SQL Editor.
-- Idempotente: usa "if not exists" donde aplica.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.quiniela_featured_picks (
  user_id         uuid         not null references auth.users on delete cascade,
  jornada         text         not null,
  -- Snapshot del partido destacado al momento del pick (no cambia si la
  -- jornada se refresca y el matchScore varía marginalmente).
  espn_id         text         not null,
  league_slug     text         not null,                   -- e.g. 'soccer/esp.1' — necesario para summary lookup
  -- El jugador elegido. `player_id` es el id de ESPN athlete (string),
  -- usado para matchear con keyEvents.participants[0].athlete.id en la
  -- resolución. `player_name` para display. `player_team_side` para
  -- mostrar logo/abbrev sin re-fetch.
  player_id       text         not null,
  player_name     text         not null,
  player_team_side text        not null check (player_team_side in ('home','away')),
  -- Estado de resolución
  resolved        boolean      not null default false,
  goals_scored    int          not null default 0,         -- goles del player elegido en el partido (0 si no marcó)
  awarded_coins   int          not null default 0,         -- monedas acreditadas (0 si no marcó)
  -- Audit
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now(),
  computed_at     timestamptz,                              -- timestamp del último intento de resolución (null hasta resolver)
  primary key (user_id, jornada)
);

-- Para listados por jornada (estadísticas / leaderboard del feature)
create index if not exists qfp_jornada_resolved_idx
  on public.quiniela_featured_picks (jornada, resolved);

-- Para historial del usuario en su perfil
create index if not exists qfp_user_time_idx
  on public.quiniela_featured_picks (user_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────
-- Lectura pública del pick agregado (para futuras vistas tipo
-- «el N% eligió a Vinícius»). El campo sensible es user_id, pero
-- ya es uuid sin info personal. Escritura solo del propio usuario.
-- La resolución (update resolved/goals_scored/awarded_coins/computed_at)
-- se hace desde el endpoint server con adminSupabase, así que no
-- requiere policy de update — service_role la salta.
alter table public.quiniela_featured_picks enable row level security;

drop policy if exists "qfp_read"   on public.quiniela_featured_picks;
drop policy if exists "qfp_insert" on public.quiniela_featured_picks;
drop policy if exists "qfp_update_self" on public.quiniela_featured_picks;
drop policy if exists "qfp_delete_self" on public.quiniela_featured_picks;

create policy "qfp_read" on public.quiniela_featured_picks
  for select using (true);

create policy "qfp_insert" on public.quiniela_featured_picks
  for insert with check (auth.uid() = user_id);

-- Update solo el dueño y solo si no está resuelta (cambiar de jugador
-- antes del kickoff). El servidor controla el kickoff aparte; esta
-- policy es una defensa adicional: nadie modifica una pick resuelta.
create policy "qfp_update_self" on public.quiniela_featured_picks
  for update using (auth.uid() = user_id and resolved = false);

create policy "qfp_delete_self" on public.quiniela_featured_picks
  for delete using (auth.uid() = user_id and resolved = false);

-- ── Trigger updated_at (reusa la función global del schema base) ──
drop trigger if exists qfp_updated_at on public.quiniela_featured_picks;
create trigger qfp_updated_at
  before update on public.quiniela_featured_picks
  for each row execute procedure public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- Verificación tras aplicar:
--   select tablename from pg_tables where schemaname='public'
--     and tablename='quiniela_featured_picks';
--   select policyname from pg_policies where tablename='quiniela_featured_picks';
-- ─────────────────────────────────────────────────────────────────
