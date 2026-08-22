-- ─────────────────────────────────────────────────────────────────────────────
-- 131 — El ×2 lo elige el jugador · el Pleno deja de ser todo o nada
--
-- ── Capitán ────────────────────────────────────────────────────────────────
-- El ×2 lo ponía la casa: `ranked_events.featured`. Como el Partidazo es el
-- mismo para todos, ese multiplicador escalaba a todo el mundo por igual y no
-- distinguía a nadie — era señal editorial disfrazada de mecánica.
--
-- Y el juego lo necesitaba, porque todos los partidos pagaban lo mismo: dos
-- jugadores que marcaran los favoritos sacaban idéntica puntuación, siempre. De
-- nueve partidos, solo decidían los dos o tres reñidos.
--
-- Ahora el ×2 es del jugador (`prediction.captain`), así que los nueve pasan a
-- ser una decisión: no solo quién gana, también dónde apuestas fuerte. `featured`
-- se queda como lo que siempre fue de verdad —el partido de la semana, el que
-- abre la sección— pero ya no multiplica.
--
-- ── Pleno escalonado ───────────────────────────────────────────────────────
-- Exigía acertar los N. Con un 55% de acierto por partido —que es bueno— eso
-- cae una vez cada doscientas jornadas, y se anunciaba en la cabecera todas las
-- semanas: un premio que nadie gana enseña a ignorar el sitio donde lo pusimos.
--
-- Tres escalones, en fallos permitidos, y proporcionales al tamaño de la
-- Jornada (una semana de 7 no debe pagar como una de 9):
--     0 fallos → 3 × N     · 1 fallo → N     · 2 fallos → N / 2
-- El escalón de 1 fallo pide N ≥ 5 y el de 2 pide N ≥ 7; en Jornadas cortas
-- fallar dos de cuatro no es ninguna gesta.
--
-- Sigue exigiendo haber pronosticado TODOS los partidos: si no, saltarse los
-- difíciles sería la jugada óptima.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.score_ranked_prediction(
  p_event_id   text,
  p_winner     text,
  p_home_score integer DEFAULT NULL::integer,
  p_away_score integer DEFAULT NULL::integer
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sport    text;
  v_credited int;
  v_scored   boolean;
BEGIN
  IF p_winner NOT IN ('1','X','2') THEN
    RAISE EXCEPTION 'winner must be 1, X or 2';
  END IF;

  SELECT sport INTO v_sport FROM ranked_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event % not found', p_event_id;
  END IF;

  v_scored := (p_home_score IS NOT NULL AND p_away_score IS NOT NULL);

  -- El ×2 sale de la predicción, no del evento: cada usuario tiene su capitán.
  UPDATE ranked_predictions
  SET
    is_correct = (prediction->>'pick' = p_winner),
    points_awarded = (
      CASE
        -- Apuesta al marcador: sustituye a la tendencia (migración 128).
        WHEN v_scored AND prediction ? 'exactScore' THEN
          CASE
            WHEN prediction->>'pick' = p_winner
             AND (prediction->'exactScore'->>'home')::int = p_home_score
             AND (prediction->'exactScore'->>'away')::int = p_away_score
            THEN 12
            ELSE 0
          END
        WHEN prediction->>'pick' = p_winner THEN 3
        ELSE 0
      END
    ) * CASE WHEN prediction->>'captain' = 'true' THEN 2 ELSE 1 END
  WHERE event_id   = p_event_id
    AND is_correct IS NULL;

  GET DIAGNOSTICS v_credited = ROW_COUNT;

  IF v_credited > 0 THEN
    WITH ins AS (
      INSERT INTO point_transactions (user_id, amount, source, sport, context)
      SELECT
        rp.user_id,
        rp.points_awarded,
        'ranked_prediction',
        v_sport,
        jsonb_build_object(
          'event_id',   p_event_id,
          'winner',     p_winner,
          'home_score', p_home_score,
          'away_score', p_away_score,
          'captain',    (rp.prediction->>'captain' = 'true'),
          'exact_bet',  (rp.prediction ? 'exactScore'),
          'exact_hit',  (v_scored
                         AND rp.prediction ? 'exactScore'
                         AND (rp.prediction->'exactScore'->>'home')::int = p_home_score
                         AND (rp.prediction->'exactScore'->>'away')::int = p_away_score)
        )
      FROM ranked_predictions rp
      WHERE rp.event_id       = p_event_id
        AND rp.is_correct     = true
        AND rp.points_awarded > 0
      ON CONFLICT (user_id, (context->>'event_id'))
      WHERE source = 'ranked_prediction'
      DO NOTHING
      RETURNING user_id, amount
    )
    UPDATE profiles p
    SET points_balance = points_balance + ins.amount
    FROM ins
    WHERE p.id = ins.user_id;
  END IF;

  -- Incondicional: un partido que nadie pronosticó también queda resuelto, o su
  -- Jornada no cierra nunca (migración 130).
  UPDATE ranked_events
  SET
    status = 'resolved',
    result = jsonb_build_object('winner', p_winner, 'home_score', p_home_score, 'away_score', p_away_score)
  WHERE id = p_event_id;

  RETURN (SELECT COUNT(*) FROM ranked_predictions WHERE event_id = p_event_id AND is_correct = true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.award_jornada_pleno(p_week_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total   int;
  v_pending int;
  v_awarded int;
BEGIN
  IF p_week_key IS NULL OR p_week_key = '' THEN
    RETURN 0;
  END IF;

  SELECT
    count(*) FILTER (WHERE status = 'resolved'),
    count(*) FILTER (WHERE status <> 'resolved')
  INTO v_total, v_pending
  FROM ranked_events
  WHERE sport = 'football'
    AND meta->>'week_key' = p_week_key;

  -- Jornada aún viva, o demasiado pequeña para que el premio signifique algo.
  IF v_pending > 0 OR v_total < 3 THEN
    RETURN 0;
  END IF;

  WITH jornada AS (
    SELECT id
    FROM ranked_events
    WHERE sport = 'football'
      AND meta->>'week_key' = p_week_key
      AND status = 'resolved'
  ),
  -- Un jugador entra si pronosticó TODOS los partidos. `count(*) = v_total` con
  -- la unicidad (user_id, event_id) lo garantiza sin poder inflarlo.
  jugadores AS (
    SELECT
      rp.user_id,
      count(*) FILTER (WHERE rp.is_correct) AS aciertos
    FROM ranked_predictions rp
    JOIN jornada j ON j.id = rp.event_id
    GROUP BY rp.user_id
    HAVING count(*) = v_total AND count(*) FILTER (WHERE rp.is_correct IS NULL) = 0
  ),
  premiados AS (
    SELECT
      user_id,
      v_total - aciertos AS fallos,
      CASE
        WHEN v_total - aciertos = 0                    THEN v_total * 3
        WHEN v_total - aciertos = 1 AND v_total >= 5   THEN v_total
        WHEN v_total - aciertos = 2 AND v_total >= 7   THEN v_total / 2
        ELSE 0
      END AS bonus
    FROM jugadores
  ),
  ins AS (
    INSERT INTO point_transactions (user_id, amount, source, sport, context)
    SELECT
      p.user_id,
      p.bonus,
      'ranked_pleno',
      'football',
      jsonb_build_object('week_key', p_week_key, 'matches', v_total, 'misses', p.fallos)
    FROM premiados p
    WHERE p.bonus > 0
    ON CONFLICT (user_id, (context->>'week_key'))
    WHERE source = 'ranked_pleno'
    DO NOTHING
    RETURNING user_id, amount
  )
  UPDATE profiles pr
  SET points_balance = points_balance + ins.amount
  FROM ins
  WHERE pr.id = ins.user_id;

  GET DIAGNOSTICS v_awarded = ROW_COUNT;
  RETURN v_awarded;
END;
$function$;
