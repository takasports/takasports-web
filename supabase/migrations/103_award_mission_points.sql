-- F4·T5 paso 2 — misiones a puntos reales.
-- RPC idempotente (una acreditación por usuario+misión+periodo) con tope diario
-- en puntos de misión. El monto lo fija el servidor (route), no el cliente.
-- Mismo patrón de seguridad que award_game_points (065): SECURITY DEFINER,
-- search_path fijo, solo service_role, ledger + points_balance atómicos.
-- Aplicada a prod (ybjmokuppfcnptyouagr) vía MCP el 2026-07-11.

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_txns_mission
  ON public.point_transactions (user_id, ((context->>'mission_id')), ((context->>'period')))
  WHERE source = 'mission';

CREATE OR REPLACE FUNCTION public.award_mission_points(
  p_mission_id text,
  p_period     text,
  p_amount     integer,
  p_user_id    uuid,
  p_daily_cap  integer DEFAULT 40
) RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  day_key   text := to_char((now() AT TIME ZONE 'Europe/Madrid')::date, 'YYYY-MM-DD');
  day_total int;
  grant_amt int;
BEGIN
  IF current_role <> 'service_role' THEN
    RAISE EXCEPTION 'award_mission_points: solo service_role';
  END IF;
  IF p_user_id IS NULL OR p_mission_id IS NULL OR p_period IS NULL THEN
    RAISE EXCEPTION 'award_mission_points: faltan argumentos';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN 0; END IF;
  IF p_amount > 100 THEN RAISE EXCEPTION 'award_mission_points: amount % fuera de rango', p_amount; END IF;
  IF p_daily_cap IS NULL OR p_daily_cap < 0 THEN p_daily_cap := 40; END IF;

  -- Idempotencia: si ya se acreditó esta misión en este periodo, no repetir.
  PERFORM 1 FROM point_transactions
    WHERE user_id = p_user_id AND source = 'mission'
      AND (context->>'mission_id') = p_mission_id
      AND (context->>'period') = p_period;
  IF FOUND THEN RETURN 0; END IF;

  -- Tope diario: suma de puntos de misión de HOY (día Madrid).
  SELECT COALESCE(SUM(amount), 0) INTO day_total
    FROM point_transactions
   WHERE user_id = p_user_id AND source = 'mission'
     AND (context->>'day') = day_key;

  IF day_total >= p_daily_cap THEN RETURN 0; END IF;
  grant_amt := LEAST(p_amount, p_daily_cap - day_total);
  IF grant_amt <= 0 THEN RETURN 0; END IF;

  BEGIN
    INSERT INTO point_transactions (user_id, amount, source, sport, context)
    VALUES (p_user_id, grant_amt, 'mission', 'all',
            jsonb_build_object('mission_id', p_mission_id, 'period', p_period, 'day', day_key));
  EXCEPTION WHEN unique_violation THEN
    RETURN 0;
  END;

  INSERT INTO profiles (id, points_balance)
  VALUES (p_user_id, grant_amt)
    ON CONFLICT (id) DO UPDATE SET points_balance = profiles.points_balance + grant_amt;

  RETURN grant_amt;
END;
$function$;

REVOKE ALL ON FUNCTION public.award_mission_points(text,text,integer,uuid,integer) FROM public;
REVOKE ALL ON FUNCTION public.award_mission_points(text,text,integer,uuid,integer) FROM anon;
REVOKE ALL ON FUNCTION public.award_mission_points(text,text,integer,uuid,integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.award_mission_points(text,text,integer,uuid,integer) TO service_role;
