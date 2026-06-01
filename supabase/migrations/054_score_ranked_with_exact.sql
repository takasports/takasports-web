-- ─────────────────────────────────────────────────────────────────
-- ME2 — Score con marcador exacto en Mundial / Ranked.
--
-- Antes: score_ranked_prediction otorgaba 3 pts por tendencia (6 featured).
-- Ahora: si la predicción incluye un `exactScore` y coincide con el
-- resultado real Y la tendencia es correcta, suma un bonus de +3 (+6
-- si el partido es featured — consistente con el x2 de tendencia).
--
-- Estructura del JSONB prediction:
--   { pick: '1'|'X'|'2', exactScore?: { home: int, away: int } }
--
-- Total posible por partido:
--   · Tendencia OK normal           = 3
--   · Tendencia OK featured         = 6
--   · Tendencia + Exact normal      = 3 + 3 = 6
--   · Tendencia + Exact featured    = 6 + 6 = 12
--   · Tendencia mal                 = 0 (exact no aplica sin tendencia)
--
-- Sigue siendo idempotente: solo actualiza filas con is_correct IS NULL.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.score_ranked_prediction(
  p_event_id   text,
  p_winner     text,
  p_home_score integer DEFAULT NULL,
  p_away_score integer DEFAULT NULL
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
  -- Validar pick
  IF p_winner NOT IN ('1','X','2') THEN
    RAISE EXCEPTION 'winner must be 1, X or 2';
  END IF;

  -- Leer evento
  SELECT featured INTO v_featured
  FROM ranked_events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event % not found', p_event_id;
  END IF;

  -- Tendencia: 3 normal, 6 featured
  v_base  := CASE WHEN v_featured THEN 6 ELSE 3 END;
  -- Marcador exacto: 3 normal, 6 featured (mismo multiplicador que tendencia)
  v_bonus := CASE WHEN v_featured THEN 6 ELSE 3 END;

  -- Marcar predicciones (idempotente: solo las aún sin score).
  -- - is_correct = tendencia correcta
  -- - points_awarded:
  --     · si tendencia mal → 0
  --     · si tendencia OK  → v_base + (exact OK ? v_bonus : 0)
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

  -- EARLY RETURN: evento ya scorado antes → no doble crédito.
  IF v_credited = 0 THEN
    RETURN (SELECT COUNT(*) FROM ranked_predictions WHERE event_id = p_event_id AND is_correct = true);
  END IF;

  -- Acreditar puntos en profiles.points_balance
  UPDATE profiles p
  SET points_balance = points_balance + rp.points_awarded
  FROM ranked_predictions rp
  WHERE rp.event_id     = p_event_id
    AND rp.is_correct   = true
    AND rp.points_awarded > 0
    AND p.id = rp.user_id;

  -- Insertar en ledger universal (idempotente vía índice único)
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
  DO NOTHING;

  -- Resolver evento
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
