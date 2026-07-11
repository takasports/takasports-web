-- F4·T5 paso 6 — REINICIO del ledger de puntos + backfill de insignias.
-- Decisión del dueño (D5): borrón y cuenta nueva al lanzar la economía unificada
-- + curva recalibrada. Se ejecuta EN EL HITO, después de desplegar el código web
-- (curva nueva + badge=+50). Pocos usuarios (2 filas de predicción) → seguro.
--
-- Re-ejecutable: el DELETE vacía TODO (incl. el backfill previo) y se rehace desde
-- quiniela_badges → mismo resultado. Aplicada a prod (ybjmokuppfcnptyouagr) vía MCP.

-- Bloque DO = una sola sentencia atómica (si algo falla, revierte todo).
DO $$
BEGIN
  -- 1) Vaciar el ledger (arranca economía unificada limpia).
  DELETE FROM public.point_transactions;

  -- 2) Backfill: cada insignia YA desbloqueada acredita +50 puntos reales
  --    (source='badge'), para que nadie pierda los puntos de sus logros. Una fila
  --    por (user_id, badge_id) — quiniela_badges tiene PK compuesta, sin duplicados.
  INSERT INTO public.point_transactions (user_id, amount, source, sport, context)
  SELECT user_id, 50, 'badge', 'all', jsonb_build_object('badge_id', badge_id)
  FROM public.quiniela_badges;

  -- 3) Asegurar fila de profiles para cada usuario con puntos y recomputar
  --    points_balance desde el ledger (fuente de verdad = suma de point_transactions).
  INSERT INTO public.profiles (id, points_balance)
  SELECT DISTINCT user_id, 0 FROM public.point_transactions
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.profiles p
  SET points_balance = COALESCE(
    (SELECT SUM(amount) FROM public.point_transactions t WHERE t.user_id = p.id AND t.amount > 0),
    0
  );
END $$;
