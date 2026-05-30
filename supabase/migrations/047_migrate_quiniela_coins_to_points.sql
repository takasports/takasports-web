-- 047 — Migración one-time: convierte saldo positivo histórico de
-- quiniela_coin_txns → point_transactions (source='quiniela_legacy').
--
-- Estrategia: por cada user con coins positivas históricas, inserta UNA
-- fila agregada en point_transactions. Idempotente: el filtro
-- WHERE source='quiniela_legacy' evita doble inserción si ya corrió.
--
-- Correr ANTES de desplegar el código que lee XP desde point_transactions.
-- No toca quiniela_coin_txns (read-only en esa tabla).

INSERT INTO point_transactions (user_id, amount, sport, source, context)
SELECT
  user_id,
  SUM(amount) FILTER (WHERE amount > 0)::integer       AS lifetime_positive,
  'futbol'                                              AS sport,
  'quiniela_legacy'                                     AS source,
  jsonb_build_object(
    'migrated_at',   NOW(),
    'txns_count',    COUNT(*) FILTER (WHERE amount > 0),
    'note',          'Histórico Quiniela coins migrado a Taka points'
  )                                                     AS context
FROM quiniela_coin_txns
WHERE user_id NOT IN (
  -- Idempotencia: omitir users que ya tienen entrada de migración
  SELECT user_id FROM point_transactions WHERE source = 'quiniela_legacy'
)
GROUP BY user_id
HAVING SUM(amount) FILTER (WHERE amount > 0) > 0;

-- Actualizar profiles.points_balance para reflejar los puntos migrados
-- (solo para users que aún no tienen balance o tienen 0)
UPDATE profiles p
SET    points_balance = p.points_balance + pt.migrated_amount
FROM (
  SELECT user_id, amount AS migrated_amount
  FROM   point_transactions
  WHERE  source = 'quiniela_legacy'
    AND  created_at >= NOW() - INTERVAL '5 minutes'  -- solo los recién insertados
) pt
WHERE p.id = pt.user_id;
