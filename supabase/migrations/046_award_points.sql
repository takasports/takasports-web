-- 046 — Función award_points para acreditar puntos Taka desde server-side.
-- Unifica todos los rewards del sistema en point_transactions.
-- Reemplaza add_coins para nuevas acreditaciones (quiniela settle,
-- ranked predictions, etc.). Solo callable por service_role.
--
-- Parámetros:
--   p_user_id  — destinatario
--   p_amount   — puntos a acreditar (> 0 requerido)
--   p_sport    — 'futbol' | 'mundial' | 'ufc' | 'all' | etc.
--   p_source   — clave de origen ('quiniela_settle', 'ranked_settle', etc.)
--   p_reason   — texto legible (para histórico del user)
--   p_context  — JSONB libre para auditoría
--
-- Idempotencia: no incluida en esta función — el caller es responsable
-- de verificar antes o usar UNIQUE constraints (ver 044_streak_milestone_unique).

CREATE OR REPLACE FUNCTION award_points(
  p_user_id  uuid,
  p_amount   integer,
  p_sport    text    DEFAULT 'all',
  p_source   text    DEFAULT 'award',
  p_reason   text    DEFAULT NULL,
  p_context  jsonb   DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: solo positivos
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  -- Cap de seguridad por txn (10k pts máx — cubre plenos de alta cuota)
  IF p_amount > 10000 THEN
    RAISE EXCEPTION 'award_points: amount % exceeds cap 10000', p_amount;
  END IF;

  -- Registrar en ledger universal
  INSERT INTO point_transactions (user_id, amount, sport, source, context)
  VALUES (
    p_user_id,
    p_amount,
    p_sport,
    p_source,
    p_context || CASE
      WHEN p_reason IS NOT NULL THEN jsonb_build_object('reason', p_reason)
      ELSE '{}'::jsonb
    END
  );

  -- Actualizar balance en profiles (upsert atómico)
  INSERT INTO profiles (id, points_balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (id) DO UPDATE
    SET points_balance = profiles.points_balance + EXCLUDED.points_balance;
END;
$$;

-- Solo service_role puede llamar award_points (nunca el cliente directamente)
REVOKE ALL ON FUNCTION award_points(uuid, integer, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION award_points(uuid, integer, text, text, text, jsonb) TO service_role;
