-- 123 · score_ranked_prediction escribía el deporte a mano ('mundial')
--
-- La RPC que puntúa las predicciones de fútbol/Mundial insertaba en
-- point_transactions con `sport = 'mundial'` literal. Mientras el único
-- producto de fútbol fue el Mundial 2026 daba igual; con Ranked Fútbol
-- (sport='football') deja de dar igual:
--
--   · get_ranked_leaderboard(p_sport) filtra `pt.sport = p_sport`, así que los
--     puntos de una jornada de LaLiga aterrizarían en la pestaña "Mundial 2026"
--     — un torneo cerrado — y la pestaña de fútbol saldría siempre vacía.
--   · close-week?sport=football no encontraría a nadie a quien premiar el lunes.
--
-- El usuario acertaría su pick, vería el +3 en la tarjeta y su marcador no
-- subiría en ninguna clasificación. Fallo silencioso: ni error ni log.
--
-- FIX: el deporte se lee del propio evento (ranked_events.sport) en el mismo
-- SELECT que ya traía `featured`, sin consulta extra. Sin cambios de escala,
-- fórmula, firma ni idempotencia: solo deja de estar cableado.
--
-- Nota: las filas ya escritas del Mundial 2026 siguen siendo correctas
-- (sport='mundial' es lo que les tocaba), así que no hay backfill.

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
  v_sport    text;
  v_base     int;
  v_bonus    int;
  v_credited int;
BEGIN
  IF p_winner NOT IN ('1','X','2') THEN
    RAISE EXCEPTION 'winner must be 1, X or 2';
  END IF;

  -- El deporte viaja con el evento: 'football' (Ranked Fútbol) o 'mundial'
  -- (archivo del Mundial 2026). Es lo que decide en qué clasificación cuentan
  -- estos puntos.
  SELECT featured, sport INTO v_featured, v_sport
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
      v_sport,
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
