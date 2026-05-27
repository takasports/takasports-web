-- ─────────────────────────────────────────────────────────────────
-- 036 — Premios para predicciones de torneo (campeón, bota de oro…)
--
-- Antes: `quiniela_season_questions` tenía question + options + resolved
-- pero NO había mecanismo de premio. Las predicciones eran cosméticas:
-- el user respondía, el admin marcaba el ganador, pero no se acreditaba
-- nada al acertante.
--
-- Ahora: cada pregunta tiene `prize_coins` (escalado por dificultad).
-- Al resolverse, el endpoint /api/quiniela/season/resolve acredita a
-- cada acertante vía add_coins() con context.source='season_question'.
-- El flag prize_credited en predictions garantiza idempotencia.
--
-- También añade `tournament` para agrupar preguntas por torneo
-- (mundial2026, eurocopa2028, etc.) — útil para badges de tipo
-- "Profeta del Mundial 2026" (acertar ≥3 preguntas del mismo
-- tournament).
--
-- Idempotente: usa "add column if not exists" donde aplica.
-- ─────────────────────────────────────────────────────────────────

alter table public.quiniela_season_questions
  add column if not exists prize_coins int not null default 0;

alter table public.quiniela_season_questions
  add column if not exists tournament text;

-- Índice para filtrar preguntas por torneo (badge "Profeta del
-- Mundial 2026" lee todas las del tournament=mundial2026).
create index if not exists qsq_tournament_idx
  on public.quiniela_season_questions (tournament)
  where tournament is not null;

alter table public.quiniela_season_predictions
  add column if not exists prize_credited boolean not null default false;

-- ─────────────────────────────────────────────────────────────────
-- Verificación tras aplicar:
--   select column_name from information_schema.columns
--   where table_name = 'quiniela_season_questions';
--   -- Debe incluir prize_coins, tournament.
-- ─────────────────────────────────────────────────────────────────
