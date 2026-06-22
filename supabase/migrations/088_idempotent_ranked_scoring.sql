-- 088 · Idempotencia de los scorers de predicciones (Ranked/Mundial + UFC)
--
-- BUG: score_ranked_prediction / score_ufc_prediction primero puntúan las
-- predicciones nuevas (is_correct IS NULL) y, si hubo alguna, ACTUALIZAN
-- profiles.points_balance sumando los puntos de TODAS las predicciones correctas
-- del evento — no solo las recién acreditadas. El ledger (point_transactions) ya
-- es idempotente (ON CONFLICT DO NOTHING por user+event), pero el balance NO:
-- si la RPC se re-ejecuta para el mismo evento y aparece ≥1 predicción nueva
-- (pick tardío, re-resolución por cambio de resultado de ESPN…), todos los
-- acertantes previos vuelven a sumar puntos → balance doblado.
--
-- FIX: acreditar PRIMERO al ledger (idempotente) y sumar al balance SOLO las
-- filas REALMENTE insertadas (RETURNING). Así el balance siempre refleja
-- exactamente lo que entró al ledger → re-ejecutar es seguro. Sin cambios de
-- escala, fórmula ni firma; pre-lanzamiento (point_transactions = 0 filas).

-- ── Ranked / Mundial ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.score_ranked_prediction(
  p_event_id text,
  p_winner text,
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
  v_base     int;
  v_bonus    int;
  v_credited int;
BEGIN
  IF p_winner NOT IN ('1','X','2') THEN
    RAISE EXCEPTION 'winner must be 1, X or 2';
  END IF;

  SELECT featured INTO v_featured
  FROM ranked_events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event % not found', p_event_id;
  END IF;

  v_base  := CASE WHEN v_featured THEN 6 ELSE 3 END;
  v_bonus := CASE WHEN v_featured THEN 6 ELSE 3 END;

  UPDATE ranked_predictions
  SET
    is_correct = (prediction->>'pick' = p_winner),
    points_awarded = CASE
      WHEN prediction->>'pick' = p_winner THEN
        v_base
        + CASE
            WHEN p_home_score IS NOT NULL
             AND p_away_score IS NOT NULL
             AND (prediction->'exactScore'->>'home')::int IS NOT DISTINCT FROM p_home_score
             AND (prediction->'exactScore'->>'away')::int IS NOT DISTINCT FROM p_away_score
            THEN v_bonus
            ELSE 0
          END
      ELSE 0
    END
  WHERE event_id   = p_event_id
    AND is_correct IS NULL;

  GET DIAGNOSTICS v_credited = ROW_COUNT;

  IF v_credited = 0 THEN
    RETURN (SELECT COUNT(*) FROM ranked_predictions WHERE event_id = p_event_id AND is_correct = true);
  END IF;

  -- Ledger primero (idempotente por user+event) y balance SOLO de lo insertado.
  WITH ins AS (
    INSERT INTO point_transactions (user_id, amount, source, sport, context)
    SELECT
      rp.user_id,
      rp.points_awarded,
      'ranked_prediction',
      'mundial',
      jsonb_build_object(
        'event_id',    p_event_id,
        'winner',      p_winner,
        'home_score',  p_home_score,
        'away_score',  p_away_score,
        'exact_hit',   (p_home_score IS NOT NULL
                        AND p_away_score IS NOT NULL
                        AND (rp.prediction->'exactScore'->>'home')::int IS NOT DISTINCT FROM p_home_score
                        AND (rp.prediction->'exactScore'->>'away')::int IS NOT DISTINCT FROM p_away_score)
      )
    FROM ranked_predictions rp
    WHERE rp.event_id     = p_event_id
      AND rp.is_correct   = true
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

-- ── UFC ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.score_ufc_prediction(
  p_event_id text,
  p_winner text,
  p_method text DEFAULT NULL::text
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_featured boolean;
  v_base     int;
  v_bonus    int;
  v_credited int;
BEGIN
  IF p_winner NOT IN ('a','b') THEN
    RAISE EXCEPTION 'winner must be a or b';
  END IF;
  IF p_method IS NOT NULL AND p_method NOT IN ('KO','SUB','DEC') THEN
    RAISE EXCEPTION 'method must be KO, SUB or DEC';
  END IF;

  SELECT featured INTO v_featured
  FROM ranked_events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event % not found', p_event_id;
  END IF;

  -- Escala baja Liga Taka (acordada):
  v_base  := CASE WHEN v_featured THEN 2 ELSE 1 END;   -- ganador: 1 (destacado 2)
  v_bonus := 2;                                         -- método: +2 plano

  UPDATE ranked_predictions
  SET
    is_correct = (prediction->>'pick' = p_winner),
    points_awarded = CASE
      WHEN prediction->>'pick' = p_winner THEN
        v_base
        + CASE
            WHEN p_method IS NOT NULL
             AND (prediction->>'method') IS NOT NULL
             AND (prediction->>'method') = p_method
            THEN v_bonus
            ELSE 0
          END
      ELSE 0
    END
  WHERE event_id   = p_event_id
    AND is_correct IS NULL;

  GET DIAGNOSTICS v_credited = ROW_COUNT;

  IF v_credited = 0 THEN
    RETURN (SELECT COUNT(*) FROM ranked_predictions WHERE event_id = p_event_id AND is_correct = true);
  END IF;

  -- Ledger primero (idempotente por user+event) y balance SOLO de lo insertado.
  WITH ins AS (
    INSERT INTO point_transactions (user_id, amount, source, sport, context)
    SELECT
      rp.user_id,
      rp.points_awarded,
      'ranked_prediction',
      'ufc',
      jsonb_build_object(
        'event_id',   p_event_id,
        'winner',     p_winner,
        'method',     p_method,
        'method_hit', (p_method IS NOT NULL
                        AND (rp.prediction->>'method') IS NOT NULL
                        AND (rp.prediction->>'method') = p_method)
      )
    FROM ranked_predictions rp
    WHERE rp.event_id     = p_event_id
      AND rp.is_correct   = true
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

  UPDATE ranked_events
  SET
    status = 'resolved',
    result = jsonb_build_object(
      'winner', p_winner,
      'method', p_method
    )
  WHERE id = p_event_id;

  RETURN (SELECT COUNT(*) FROM ranked_predictions WHERE event_id = p_event_id AND is_correct = true);
END;
$function$;
