-- ─────────────────────────────────────────────────────────────────────────────
-- 130 — Un partido que nadie pronosticó también tiene que quedar resuelto
--
-- `score_ranked_prediction` salía por la puerta de atrás cuando no actualizaba
-- ninguna predicción:
--
--     GET DIAGNOSTICS v_credited = ROW_COUNT;
--     IF v_credited = 0 THEN RETURN (...); END IF;   ← se va de aquí
--     ...
--     UPDATE ranked_events SET status = 'resolved'   ← y esto no llega a correr
--
-- El return existía por idempotencia (no pagar dos veces si el cron repite),
-- pero se llevaba por delante el marcado del evento. Efecto: **un partido que
-- nadie pronosticó no se marca NUNCA como resuelto**. Con la sección recién
-- abierta y cuatro usuarios, eso es casi todos los partidos.
--
-- Y no se queda en el partido. `award_jornada_pleno` no paga mientras quede
-- algo sin resolver, y el resultado de una Jornada no se le enseña a nadie
-- hasta que cierra entera: un solo partido sin pronosticar dejaba la semana
-- completa congelada para siempre. Había cinco así en producción, del 15 al 19
-- de agosto, y el cron los reintentaba en cada pasada sin conseguir nada
-- —devolvía éxito, porque la RPC no fallaba: simplemente no hacía su trabajo—.
--
-- Ahora el marcado del evento es incondicional y la idempotencia se queda solo
-- donde hace falta: en el pago. Repetir la llamada reescribe el mismo resultado
-- y el ON CONFLICT sigue impidiendo cobrar dos veces.
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
  v_featured boolean;
  v_sport    text;
  v_base     int;
  v_exact    int;
  v_credited int;
  v_scored   boolean;
BEGIN
  IF p_winner NOT IN ('1','X','2') THEN
    RAISE EXCEPTION 'winner must be 1, X or 2';
  END IF;

  SELECT featured, sport INTO v_featured, v_sport
  FROM ranked_events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event % not found', p_event_id;
  END IF;

  -- Reparto (migración 128): el marcador exacto SUSTITUYE a la tendencia.
  v_base   := CASE WHEN v_featured THEN 6  ELSE 3  END;
  v_exact  := CASE WHEN v_featured THEN 24 ELSE 12 END;
  v_scored := (p_home_score IS NOT NULL AND p_away_score IS NOT NULL);

  UPDATE ranked_predictions
  SET
    is_correct = (prediction->>'pick' = p_winner),
    points_awarded = CASE
      WHEN v_scored AND prediction ? 'exactScore' THEN
        CASE
          WHEN prediction->>'pick' = p_winner
           AND (prediction->'exactScore'->>'home')::int = p_home_score
           AND (prediction->'exactScore'->>'away')::int = p_away_score
          THEN v_exact
          ELSE 0
        END
      WHEN prediction->>'pick' = p_winner THEN v_base
      ELSE 0
    END
  WHERE event_id   = p_event_id
    AND is_correct IS NULL;

  GET DIAGNOSTICS v_credited = ROW_COUNT;

  -- El pago solo cuando hay algo nuevo que pagar. Sin predicciones que tocar
  -- no hay nada que acreditar, pero el evento SÍ tiene que quedar resuelto.
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

  -- INCONDICIONAL. Es la línea que faltaba.
  UPDATE ranked_events
  SET
    status = 'resolved',
    result = jsonb_build_object(
      'winner',     p_winner,
      'home_score', p_home_score,
      'away_score', p_away_score
    )
  WHERE id = p_event_id;

  RETURN (SELECT COUNT(*) FROM ranked_predictions WHERE event_id = p_event_id AND is_correct = true);
END;
$function$;
