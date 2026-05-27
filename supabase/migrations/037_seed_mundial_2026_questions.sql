-- ─────────────────────────────────────────────────────────────────
-- 037 — Seed de las 5 preguntas del Mundial 2026
--
-- Premios escalados por dificultad (decisión del 2026-05-28):
--   · Campeón                              → 1500🪙  (más difícil)
--   · Bota de oro (máximo goleador)        → 1200🪙
--   · Subcampeón / finalista perdedor      → 1000🪙
--   · Selección underdog que llega a cuartos → 800🪙
--   · Sudamericana que llega más lejos     → 500🪙   (más predecible)
--
-- Total acertando las 5: 5000🪙 + badge "Profeta del Mundial 2026".
--
-- closes_at = '2026-06-11 16:00:00+00' (justo antes del partido
-- inaugural Mundial 2026). El user no puede modificar predicciones
-- después de esa hora.
--
-- options[] está intencionalmente acotada a top contenders + "Otro".
-- Si querés ampliar (ej. añadir más selecciones), edita en Supabase.
-- ─────────────────────────────────────────────────────────────────

-- 1) CAMPEÓN — 1500🪙
insert into public.quiniela_season_questions (id, competition, season, tournament, question, options, closes_at, prize_coins)
values (
  'mundial2026_champion',
  'FIFA World Cup',
  '2026',
  'mundial2026',
  '¿Quién será campeón del Mundial 2026?',
  '[
    {"value": "ARG", "label": "Argentina"},
    {"value": "BRA", "label": "Brasil"},
    {"value": "FRA", "label": "Francia"},
    {"value": "ESP", "label": "España"},
    {"value": "ENG", "label": "Inglaterra"},
    {"value": "GER", "label": "Alemania"},
    {"value": "POR", "label": "Portugal"},
    {"value": "NED", "label": "Países Bajos"},
    {"value": "BEL", "label": "Bélgica"},
    {"value": "URU", "label": "Uruguay"},
    {"value": "CRO", "label": "Croacia"},
    {"value": "OTHER", "label": "Otra selección"}
  ]'::jsonb,
  '2026-06-11 16:00:00+00',
  1500
) on conflict (id) do update set
  prize_coins = excluded.prize_coins,
  options = excluded.options,
  closes_at = excluded.closes_at,
  tournament = excluded.tournament;

-- 2) BOTA DE ORO — 1200🪙
insert into public.quiniela_season_questions (id, competition, season, tournament, question, options, closes_at, prize_coins)
values (
  'mundial2026_top_scorer',
  'FIFA World Cup',
  '2026',
  'mundial2026',
  '¿Quién ganará la Bota de Oro (máximo goleador)?',
  '[
    {"value": "mbappe",     "label": "Kylian Mbappé"},
    {"value": "haaland",    "label": "Erling Haaland"},
    {"value": "vinicius",   "label": "Vinícius Jr."},
    {"value": "bellingham", "label": "Jude Bellingham"},
    {"value": "kane",       "label": "Harry Kane"},
    {"value": "lautaro",    "label": "Lautaro Martínez"},
    {"value": "messi",      "label": "Lionel Messi"},
    {"value": "salah",      "label": "Mohamed Salah"},
    {"value": "rodrygo",    "label": "Rodrygo"},
    {"value": "yamal",      "label": "Lamine Yamal"},
    {"value": "OTHER",      "label": "Otro jugador"}
  ]'::jsonb,
  '2026-06-11 16:00:00+00',
  1200
) on conflict (id) do update set
  prize_coins = excluded.prize_coins,
  options = excluded.options,
  closes_at = excluded.closes_at,
  tournament = excluded.tournament;

-- 3) FINALISTA (subcampeón) — 1000🪙
insert into public.quiniela_season_questions (id, competition, season, tournament, question, options, closes_at, prize_coins)
values (
  'mundial2026_runner_up',
  'FIFA World Cup',
  '2026',
  'mundial2026',
  '¿Quién será subcampeón (perderá la final)?',
  '[
    {"value": "ARG", "label": "Argentina"},
    {"value": "BRA", "label": "Brasil"},
    {"value": "FRA", "label": "Francia"},
    {"value": "ESP", "label": "España"},
    {"value": "ENG", "label": "Inglaterra"},
    {"value": "GER", "label": "Alemania"},
    {"value": "POR", "label": "Portugal"},
    {"value": "NED", "label": "Países Bajos"},
    {"value": "BEL", "label": "Bélgica"},
    {"value": "URU", "label": "Uruguay"},
    {"value": "OTHER", "label": "Otra selección"}
  ]'::jsonb,
  '2026-06-11 16:00:00+00',
  1000
) on conflict (id) do update set
  prize_coins = excluded.prize_coins,
  options = excluded.options,
  closes_at = excluded.closes_at,
  tournament = excluded.tournament;

-- 4) SORPRESA — 800🪙. Selección "underdog" (ni europea top ni
-- sudamericana grande) que llega al menos a cuartos de final.
insert into public.quiniela_season_questions (id, competition, season, tournament, question, options, closes_at, prize_coins)
values (
  'mundial2026_surprise',
  'FIFA World Cup',
  '2026',
  'mundial2026',
  '¿Qué selección underdog llegará al menos a cuartos?',
  '[
    {"value": "MAR", "label": "Marruecos"},
    {"value": "USA", "label": "Estados Unidos"},
    {"value": "MEX", "label": "México"},
    {"value": "JPN", "label": "Japón"},
    {"value": "SEN", "label": "Senegal"},
    {"value": "KOR", "label": "Corea del Sur"},
    {"value": "AUS", "label": "Australia"},
    {"value": "ECU", "label": "Ecuador"},
    {"value": "CAN", "label": "Canadá"},
    {"value": "EGY", "label": "Egipto"},
    {"value": "NONE", "label": "Ninguna llega a cuartos"}
  ]'::jsonb,
  '2026-06-11 16:00:00+00',
  800
) on conflict (id) do update set
  prize_coins = excluded.prize_coins,
  options = excluded.options,
  closes_at = excluded.closes_at,
  tournament = excluded.tournament;

-- 5) SUDAMERICANO MÁS LEJOS — 500🪙. La más predecible (CONMEBOL
-- históricamente fuerte). Pregunta accesible para casuales.
insert into public.quiniela_season_questions (id, competition, season, tournament, question, options, closes_at, prize_coins)
values (
  'mundial2026_southamerica_farthest',
  'FIFA World Cup',
  '2026',
  'mundial2026',
  '¿Qué selección sudamericana llegará más lejos?',
  '[
    {"value": "ARG", "label": "Argentina"},
    {"value": "BRA", "label": "Brasil"},
    {"value": "URU", "label": "Uruguay"},
    {"value": "COL", "label": "Colombia"},
    {"value": "ECU", "label": "Ecuador"},
    {"value": "PAR", "label": "Paraguay"}
  ]'::jsonb,
  '2026-06-11 16:00:00+00',
  500
) on conflict (id) do update set
  prize_coins = excluded.prize_coins,
  options = excluded.options,
  closes_at = excluded.closes_at,
  tournament = excluded.tournament;

-- ─────────────────────────────────────────────────────────────────
-- Verificación tras aplicar:
--   select id, question, prize_coins from public.quiniela_season_questions
--   where tournament = 'mundial2026'
--   order by prize_coins desc;
-- ─────────────────────────────────────────────────────────────────
