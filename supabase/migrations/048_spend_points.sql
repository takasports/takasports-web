-- 048 — Función spend_points para descontar puntos Taka de forma atómica.
-- Reemplaza add_coins(-amount) en el stake de la quiniela.
-- Solo callable por service_role. Lanza insufficient_balance si el saldo
-- es insuficiente (la RPC lo detecta en score/route.ts).

CREATE OR REPLACE FUNCTION spend_points(
  p_user_id  uuid,
  p_amount   integer,
  p_sport    text    DEFAULT 'futbol',
  p_source   text    DEFAULT 'stake',
  p_reason   text    DEFAULT NULL,
  p_context  jsonb   DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  IF p_amount > 10000 THEN
    RAISE EXCEPTION 'spend_points: amount % exceeds cap 10000', p_amount;
  END IF;

  -- Verificar saldo con lock de fila (evita race conditions)
  SELECT points_balance INTO cur_balance
  FROM   profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  IF cur_balance IS NULL OR cur_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Registrar gasto (negativo) en el ledger universal
  INSERT INTO point_transactions (user_id, amount, sport, source, context)
  VALUES (
    p_user_id,
    -p_amount,
    p_sport,
    p_source,
    p_context || CASE
      WHEN p_reason IS NOT NULL THEN jsonb_build_object('reason', p_reason)
      ELSE '{}'::jsonb
    END
  );

  -- Descontar del balance
  UPDATE profiles
  SET    points_balance = points_balance - p_amount
  WHERE  id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION spend_points(uuid, integer, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION spend_points(uuid, integer, text, text, text, jsonb) TO service_role;
