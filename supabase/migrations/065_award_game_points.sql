-- 065_award_game_points.sql
-- Documenta el RPC award_game_points, que ya está VIVO en prod (se aplicó vía
-- MCP el 2026-06-08 sin commitear el archivo → este fichero cierra el drift
-- repo↔prod). CREATE OR REPLACE idéntico a la def viva (pg_get_functiondef):
-- es idempotente y NO re-aplica nada nuevo.
--
-- Acredita la tarifa de un minijuego a la Liga Taka (point_transactions +
-- profiles.points_balance):
--   · idempotente por (user, game_id, period) sobre source='minigame'
--   · mejor-marca-gana: al repetir, solo suma el delta si la nueva marca supera
--   · a prueba de carreras (SELECT … FOR UPDATE + manejo de unique_violation)
--   · service_role-only para p_user_id (cliente solo puede acreditarse a sí mismo)
-- SECURITY DEFINER + search_path 'public'. Cap defensivo de 500 por txn.

CREATE OR REPLACE FUNCTION public.award_game_points(p_game_id text, p_period text, p_amount integer, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid; v_old int; v_delta int;
BEGIN
  IF p_user_id IS NOT NULL THEN
    IF current_role <> 'service_role' THEN RAISE EXCEPTION 'p_user_id solo service_role'; END IF;
    uid := p_user_id;
  ELSE uid := auth.uid(); END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN 0; END IF;
  IF p_game_id IS NULL OR p_period IS NULL THEN RAISE EXCEPTION 'game_id and period required'; END IF;
  IF p_game_id NOT IN ('crackquiz','mionce','sopacracks','takagrid') THEN RAISE EXCEPTION 'unknown game_id %', p_game_id; END IF;
  IF p_amount > 500 THEN RAISE EXCEPTION 'amount out of range'; END IF;

  SELECT amount INTO v_old FROM point_transactions
   WHERE user_id=uid AND source='minigame'
     AND (context->>'game_id')=p_game_id AND (context->>'period')=p_period FOR UPDATE;

  IF v_old IS NULL THEN
    BEGIN
      INSERT INTO point_transactions (user_id, amount, source, sport, context)
      VALUES (uid, p_amount, 'minigame', 'all', jsonb_build_object('game_id',p_game_id,'period',p_period));
    EXCEPTION WHEN unique_violation THEN
      SELECT amount INTO v_old FROM point_transactions
       WHERE user_id=uid AND source='minigame'
         AND (context->>'game_id')=p_game_id AND (context->>'period')=p_period FOR UPDATE;
      IF p_amount > COALESCE(v_old,0) THEN
        v_delta := p_amount - v_old;
        UPDATE point_transactions SET amount=p_amount
         WHERE user_id=uid AND source='minigame'
           AND (context->>'game_id')=p_game_id AND (context->>'period')=p_period;
        INSERT INTO profiles (id, points_balance) VALUES (uid, v_delta)
          ON CONFLICT (id) DO UPDATE SET points_balance = profiles.points_balance + v_delta;
        RETURN v_delta;
      END IF;
      RETURN 0;
    END;
    INSERT INTO profiles (id, points_balance) VALUES (uid, p_amount)
      ON CONFLICT (id) DO UPDATE SET points_balance = profiles.points_balance + p_amount;
    RETURN p_amount;
  ELSIF p_amount > v_old THEN
    v_delta := p_amount - v_old;
    UPDATE point_transactions SET amount=p_amount
     WHERE user_id=uid AND source='minigame'
       AND (context->>'game_id')=p_game_id AND (context->>'period')=p_period;
    UPDATE profiles SET points_balance = points_balance + v_delta WHERE id = uid;
    RETURN v_delta;
  ELSE RETURN 0; END IF;
END; $function$;
