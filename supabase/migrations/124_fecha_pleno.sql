-- 124 · Pleno de la Fecha
--
-- Premia acertar TODOS los partidos de una Fecha (un día de Ranked Fútbol).
-- Es el remate del ritual diario: la tendencia paga 3 (6 en el destacado) y el
-- marcador exacto suma aparte; el pleno es lo que convierte "he acertado unos
-- cuantos" en "he clavado el día".
--
-- Reglas, y por qué:
--
--   · Mínimo 3 partidos. Un día flojo puede publicar una sola Fecha de un
--     partido; pagar pleno ahí sería regalar puntos por acertar una vez, y
--     además premiaría más los días pobres que los buenos.
--
--   · La Fecha tiene que estar CERRADA ENTERA. Si queda un partido sin
--     resolver —aplazado, o simplemente aún por jugar— el pleno todavía no se
--     puede juzgar. Sin esto, una Fecha con un aplazamiento pagaría pleno a
--     quien acertó el resto, y volvería a pagarlo si el partido se recupera.
--
--   · Hay que haber pronosticado los N partidos. Quien deja uno en blanco no
--     ha hecho pleno, por muchos que acierte.
--
--   · El bonus escala con el tamaño (2 x partidos): clavar seis partidos es
--     mucho más difícil que clavar tres y debe pagar más.
--
-- Idempotente por (user, date_key) igual que el scoring por evento: el cron la
-- llama en cada pasada y solo la primera acredita.

-- Un pleno por usuario y Fecha. Es lo que hace segura la re-ejecución.
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_txns_ranked_pleno
  ON public.point_transactions (user_id, ((context ->> 'date_key')))
  WHERE source = 'ranked_pleno';

CREATE OR REPLACE FUNCTION public.award_fecha_pleno(p_date_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total   int;
  v_pending int;
  v_bonus   int;
  v_awarded int;
BEGIN
  IF p_date_key IS NULL OR p_date_key = '' THEN
    RETURN 0;
  END IF;

  SELECT
    count(*) FILTER (WHERE status = 'resolved'),
    count(*) FILTER (WHERE status <> 'resolved')
  INTO v_total, v_pending
  FROM ranked_events
  WHERE sport = 'football'
    AND meta->>'date_key' = p_date_key;

  -- Fecha aún viva, o demasiado pequeña para que el pleno signifique algo.
  IF v_pending > 0 OR v_total < 3 THEN
    RETURN 0;
  END IF;

  v_bonus := 2 * v_total;

  WITH fecha AS (
    SELECT id
    FROM ranked_events
    WHERE sport = 'football'
      AND meta->>'date_key' = p_date_key
      AND status = 'resolved'
  ),
  plenos AS (
    SELECT rp.user_id
    FROM ranked_predictions rp
    JOIN fecha f ON f.id = rp.event_id
    GROUP BY rp.user_id
    -- count = v_total exige haber pronosticado TODOS (la unicidad
    -- (user_id, event_id) garantiza que no se pueda inflar con duplicados).
    -- bool_and sobre NULL da NULL, que el HAVING descarta: una predicción sin
    -- puntuar nunca cuela como acierto.
    HAVING count(*) = v_total AND bool_and(rp.is_correct)
  ),
  ins AS (
    INSERT INTO point_transactions (user_id, amount, source, sport, context)
    SELECT
      p.user_id,
      v_bonus,
      'ranked_pleno',
      'football',
      jsonb_build_object('date_key', p_date_key, 'matches', v_total)
    FROM plenos p
    ON CONFLICT (user_id, (context->>'date_key'))
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

-- Solo el service role la ejecuta (la llama el cron sync-football).
REVOKE ALL ON FUNCTION public.award_fecha_pleno(text) FROM PUBLIC, anon, authenticated;
