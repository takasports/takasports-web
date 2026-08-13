-- 125 · Pleno de la Jornada
--
-- Sustituye a award_fecha_pleno (migración 124): el pleno pasó de premiar un
-- DÍA a premiar la SEMANA completa (`meta->>'week_key'`), a la vez que el
-- motor de selección (football-ranked.ts) pasó de "Fecha" diaria a "Jornada"
-- semanal de 7-9 partidos. Es seguro sustituir sin migrar datos: no se ha
-- pagado nunca un pleno (0 filas con source='ranked_pleno' en
-- point_transactions), así que no hay histórico que preservar.
--
-- Reglas — las mismas que la 124, ahora a nivel semana:
--
--   · Mínimo 3 partidos. Con el suelo semanal en 7-9 esto casi nunca se roza,
--     pero una semana corta (fixture escaso, parón de selecciones) puede
--     publicar una Jornada de menos partidos, y no debe pagar pleno por
--     acertar uno o dos.
--
--   · La Jornada tiene que estar CERRADA ENTERA. Si queda un partido sin
--     resolver el pleno todavía no se puede juzgar.
--
--   · Hay que haber pronosticado los N partidos. Quien deja uno en blanco no
--     ha hecho pleno, por muchos que acierte.
--
--   · El bonus escala con el tamaño (2 x partidos): clavar nueve partidos es
--     mucho más difícil que clavar tres y debe pagar más.
--
-- Idempotente por (user, week_key) igual que el scoring por evento: el cron la
-- llama en cada pasada y solo la primera acredita.

DROP FUNCTION IF EXISTS public.award_fecha_pleno(text);
DROP INDEX IF EXISTS idx_point_txns_ranked_pleno;

-- Un pleno por usuario y Jornada. Es lo que hace segura la re-ejecución.
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_txns_ranked_pleno_semana
  ON public.point_transactions (user_id, ((context ->> 'week_key')))
  WHERE source = 'ranked_pleno';

CREATE OR REPLACE FUNCTION public.award_jornada_pleno(p_week_key text)
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

  -- Jornada aún viva, o demasiado pequeña para que el pleno signifique algo.
  IF v_pending > 0 OR v_total < 3 THEN
    RETURN 0;
  END IF;

  v_bonus := 2 * v_total;

  WITH jornada AS (
    SELECT id
    FROM ranked_events
    WHERE sport = 'football'
      AND meta->>'week_key' = p_week_key
      AND status = 'resolved'
  ),
  plenos AS (
    SELECT rp.user_id
    FROM ranked_predictions rp
    JOIN jornada j ON j.id = rp.event_id
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
      jsonb_build_object('week_key', p_week_key, 'matches', v_total)
    FROM plenos p
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

-- Solo el service role la ejecuta (la llama el cron sync-football).
REVOKE ALL ON FUNCTION public.award_jornada_pleno(text) FROM PUBLIC, anon, authenticated;
