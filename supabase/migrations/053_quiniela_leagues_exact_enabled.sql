-- ─────────────────────────────────────────────────────────────────
-- AD — Toggle de marcador exacto por liga privada.
--
-- Cada liga puede decidir si su ranking interno cuenta los puntos
-- del marcador exacto (+3 por acierto). Default: ON.
--
-- Alcance del flag:
--   · Solo afecta al ranking interno de la liga
--     (quiniela_league_member_scores.points).
--   · NO afecta al wallet personal del user ni al ranking Ranked
--     global — esos siempre cuentan exact.
--
-- Permisos UI (validado en /api/quiniela/leagues/[id]/settings):
--   · Solo el owner de la liga puede cambiar el flag.
--   · Solo cuando NO hay jornada activa con picks staked de miembros
--     (para evitar manipulación mid-torneo).
-- ─────────────────────────────────────────────────────────────────

alter table public.quiniela_leagues
  add column if not exists exact_enabled boolean not null default true;

comment on column public.quiniela_leagues.exact_enabled is
  'Si true, el ranking de la liga suma los puntos del marcador exacto. Si false, los ignora (solo cuenta tendencia + featured x2 + pleno). Default true. Solo afecta quiniela_league_member_scores.points; el wallet personal del user siempre cuenta exact.';
