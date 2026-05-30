-- Incrementa points_balance de forma atómica para evitar race conditions.
-- Usada por el sistema de milestones de racha y cualquier otra fuente
-- que necesite sumar puntos sin leer el valor actual primero.
CREATE OR REPLACE FUNCTION increment_points_balance(
  p_user_id uuid,
  p_amount  integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO profiles (id, points_balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (id) DO UPDATE
    SET points_balance = profiles.points_balance + EXCLUDED.points_balance;
$$;

-- Solo el rol autenticado puede llamarla (y service_role implícito)
GRANT EXECUTE ON FUNCTION increment_points_balance(uuid, integer) TO authenticated;
