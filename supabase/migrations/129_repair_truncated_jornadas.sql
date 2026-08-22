-- ─────────────────────────────────────────────────────────────────────────────
-- 129 — Reparación de las Jornadas que se publicaron cojas (one-off, ya aplicada)
--
-- Contexto: hasta el arreglo del horizonte en `buildRankedWeeks`, el cron
-- publicaba una semana en cuanto asomaba su LUNES por la ventana de 10 días.
-- Como una Jornada publicada no se recalcula jamás, esas semanas quedaban
-- congeladas con los partidos de un solo día. En producción había dos:
--
--   · 2026-08-24 → 5 partidos, los 5 del lunes 24, Partidazo Fulham-Chelsea
--                  elegido entre esos cinco.
--   · 2026-08-31 → 5 partidos, los 5 del lunes 31, Partidazo Aston Villa-Arsenal.
--
-- Ninguno tenía predicciones, así que se borran y el cron —ya con el horizonte
-- puesto— las vuelve a publicar enteras y eligiendo entre toda la semana. El
-- `not exists` sobre ranked_predictions es la red de seguridad: si alguien
-- hubiera pronosticado, esa fila se queda y no se le borra el pick a nadie.
--
-- Además, dos filas del modelo anterior ("Partido del Día", retirado el
-- 13-ago-2026) sobrevivieron sin `week_key` y con `featured = true`. El
-- cliente las agrupaba por su semana natural, así que aterrizaban en una
-- Jornada que YA tenía su Partidazo — y al ser más tempranas, ganaban:
-- la sección abría con un Rayo Vallecano-Alavés del jueves, ya resuelto, a
-- ancho completo. Se les escribe su week_key real y se les quita el destacado.
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM ranked_events e
WHERE e.sport = 'football'
  AND e.meta->>'week_key' IN ('2026-08-24', '2026-08-31')
  AND NOT EXISTS (SELECT 1 FROM ranked_predictions rp WHERE rp.event_id = e.id);

UPDATE ranked_events e
SET meta = COALESCE(e.meta, '{}'::jsonb) || jsonb_build_object(
      'week_key',
      to_char(date_trunc('week', (e.event_date AT TIME ZONE 'Europe/Madrid')), 'YYYY-MM-DD')
    ),
    featured = false
WHERE e.sport = 'football'
  AND (e.meta->>'week_key') IS NULL;
