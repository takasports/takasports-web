-- ─────────────────────────────────────────────────────────────────────────────
-- 128 — El marcador exacto pasa a ser una APUESTA, no un regalo
--
-- Antes: acertar la tendencia daba 3 pts (6 en el Partidazo) y, si además
-- habías escrito un marcador exacto y coincidía, +3 más (+6). El marcador
-- exacto solo sumaba: fallarlo no costaba nada. Con cinco huecos gratis por
-- usuario, la jugada óptima era rellenarlos SIEMPRE — o sea, no era una
-- decisión, era trabajo obligatorio disfrazado de opcional.
--
-- Ahora: poner marcador exacto SUSTITUYE al pronóstico de tendencia en ese
-- partido. Si lo clavas te llevas 12 pts (24 en el Partidazo); si no, ese
-- partido vale 0 aunque hubieras acertado quién ganaba. Cambias 3 puntos
-- razonablemente probables por 12 improbables, y eso sí es una elección.
--
-- `is_correct` NO cambia de significado: sigue siendo "acertó la tendencia".
-- Es deliberado — de él cuelga `award_jornada_pleno` (migración 125), así que
-- fallar un marcador exacto te cuesta los puntos de ese partido pero no te
-- tira el Pleno de la Jornada. Es el consuelo que hace la apuesta jugable.
--
-- Si el partido se resuelve sin marcador (ESPN da ganador pero no goles), el
-- exacto no se puede evaluar y se puntúa como tendencia normal: nunca se
-- castiga al usuario por un hueco de la fuente.
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
  v_scored   boolean;   -- ¿tenemos marcador real con el que juzgar un exacto?
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

  v_base   := CASE WHEN v_featured THEN 6  ELSE 3  END;
  v_exact  := CASE WHEN v_featured THEN 24 ELSE 12 END;
  v_scored := (p_home_score IS NOT NULL AND p_away_score IS NOT NULL);

  UPDATE ranked_predictions
  SET
    -- Sigue siendo la TENDENCIA. Un exacto fallado con el ganador bien
    -- puntúa 0 pero no rompe la racha del Pleno.
    is_correct = (prediction->>'pick' = p_winner),
    points_awarded = CASE
      -- Jugó a marcador exacto: todo o nada.
      WHEN v_scored AND prediction ? 'exactScore' THEN
        CASE
          WHEN prediction->>'pick' = p_winner
           AND (prediction->'exactScore'->>'home')::int = p_home_score
           AND (prediction->'exactScore'->>'away')::int = p_away_score
          THEN v_exact
          ELSE 0
        END
      -- Jugó a tendencia (o no hay marcador con el que juzgar el exacto).
      WHEN prediction->>'pick' = p_winner THEN v_base
      ELSE 0
    END
  WHERE event_id   = p_event_id
    AND is_correct IS NULL;

  GET DIAGNOSTICS v_credited = ROW_COUNT;

  IF v_credited = 0 THEN
    RETURN (SELECT COUNT(*) FROM ranked_predictions WHERE event_id = p_event_id AND is_correct = true);
  END IF;

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
