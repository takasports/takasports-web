-- 066_rescale_ufc_scoring.sql
-- Reescala score_ufc_prediction a la escala baja de la Liga Taka:
--   · ganador acertado:  1  (destacado 2)     [antes: 2 / 4]
--   · método acertado:  +2  plano             [antes: +1 normal / +2 destacado]
--
-- SOLO cambian v_base y v_bonus. El resto (ledger point_transactions, balance
-- en profiles, idempotencia ON CONFLICT, resolución del evento) es byte-idéntico
-- a la def viva leída con pg_get_functiondef. SECURITY DEFINER + search_path
-- 'public' preservados; sigue siendo service_role-only (REVOKE de migr. 064 intacto).
-- Las predicciones ya resueltas NO cambian (el UPDATE solo toca is_correct IS NULL).

CREATE OR REPLACE FUNCTION public.score_ufc_prediction(p_event_id text, p_winner text, p_method text DEFAULT NULL::text)
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

  UPDATE profiles p
  SET points_balance = points_balance + rp.points_awarded
  FROM ranked_predictions rp
  WHERE rp.event_id     = p_event_id
    AND rp.is_correct   = true
    AND rp.points_awarded > 0
    AND p.id = rp.user_id;

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
  DO NOTHING;

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
