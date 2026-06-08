-- 047 — Migración one-time: convierte saldo positivo histórico de
-- quiniela_coin_txns → point_transactions (source='quiniela_legacy').
--
-- Estrategia: por cada user con coins positivas históricas, inserta UNA
-- fila agregada en point_transactions. Idempotente: el filtro
-- WHERE source='quiniela_legacy' evita doble inserción si ya corrió.
--
-- NOTA (2026-06-09): la economía de "monedas" se retiró por completo en la
-- migración 068 (DROP de quiniela_coin_txns / quiniela_coin_balance / add_coins).
-- Esta migración nunca llegó a aplicarse con datos (0 coins, pre-lanzamiento),
-- así que ahora va GUARDADA contra la tabla: si quiniela_coin_txns no existe
-- (estado actual de prod) es un NO-OP. Se conserva por integridad del historial
-- y para que un `db push` desde cero (donde la tabla SÍ existe en su punto de la
-- secuencia, antes de 068) siga funcionando.

DO $$
BEGIN
  IF to_regclass('public.quiniela_coin_txns') IS NOT NULL THEN
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
    UPDATE profiles p
    SET    points_balance = p.points_balance + pt.migrated_amount
    FROM (
      SELECT user_id, amount AS migrated_amount
      FROM   point_transactions
      WHERE  source = 'quiniela_legacy'
        AND  created_at >= NOW() - INTERVAL '5 minutes'  -- solo los recién insertados
    ) pt
    WHERE p.id = pt.user_id;
  END IF;
END $$;
