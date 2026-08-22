-- ─────────────────────────────────────────────────────────────────────────────
-- 132 — La racha de Jornadas, que estaba declarada y nunca se calculaba
--
-- `streakCurrent` vivía en el tipo `PorraStatus` (components/PorraCTA.tsx) y lo
-- rellenaba ÚNICAMENTE `/api/quiniela/status`, que es el stack retirado (la
-- ruta /quiniela hace 301 a /predicciones). El endpoint vivo,
-- `/api/ranked/football/status`, no lo tocaba: una mecánica de retención
-- declarada y desconectada, que en un juego semanal es justo la que hace no
-- saltarse una semana.
--
-- ── Dos reglas que la hacen justa ──────────────────────────────────────────
-- 1. Una semana SIN Jornada publicada no rompe la racha. Hay semanas sin
--    Jornada a propósito (parón de selecciones, o nada que supere el listón de
--    calidad): castigar al usuario por una semana en la que no se le ofreció
--    jugar sería absurdo. Solo cuentan las semanas que existieron.
-- 2. La Jornada en curso, si aún no ha terminado, tampoco la rompe. Mientras
--    quede algo por jugar todavía puede entrar; solo cuando una Jornada acaba
--    entera sin un solo pronóstico suyo se corta.
--
-- Basta con UN pronóstico para conservarla: la racha premia aparecer, no
-- acertar. Para acertar ya está el resto del juego.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_football_streak(p_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_streak   int := 0;
  v_primera  boolean := true;
  rec        record;
BEGIN
  IF p_user IS NULL THEN
    RETURN 0;
  END IF;

  FOR rec IN
    SELECT
      e.meta->>'week_key' AS week_key,
      -- ¿Terminó la Jornada entera?
      bool_and(e.status = 'resolved') AS acabada,
      -- ¿Jugó al menos uno de esos partidos?
      bool_or(pr.user_id IS NOT NULL) AS jugada
    FROM ranked_events e
    LEFT JOIN ranked_predictions pr
      ON pr.event_id = e.id AND pr.user_id = p_user
    WHERE e.sport = 'football'
      AND e.meta->>'week_key' IS NOT NULL
    GROUP BY e.meta->>'week_key'
    ORDER BY e.meta->>'week_key' DESC
  LOOP
    IF rec.jugada THEN
      v_streak := v_streak + 1;
    ELSIF v_primera AND NOT rec.acabada THEN
      -- La Jornada más reciente sigue viva y aún no ha jugado: no cuenta, pero
      -- tampoco corta. Todavía está a tiempo.
      NULL;
    ELSE
      EXIT;
    END IF;
    v_primera := false;
  END LOOP;

  RETURN v_streak;
END;
$function$;
