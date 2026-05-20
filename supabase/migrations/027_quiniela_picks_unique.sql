-- ─────────────────────────────────────────────────────────────────
-- 027 — Una sola entrega por usuario y jornada (idempotencia)
-- Sin esto, un re-envío por red flaky duplicaría filas en
-- quiniela_picks y, peor, llamaría add_coins dos veces → monedas
-- duplicadas. Con índice único + upsert en /api/quiniela/score,
-- re-submitir es no-op para monedas (las picks se pueden actualizar
-- hasta el kickoff, pero las monedas se acreditan UNA vez).
-- ─────────────────────────────────────────────────────────────────

create unique index if not exists quiniela_picks_user_jornada_uniq
  on public.quiniela_picks (user_id, jornada);
