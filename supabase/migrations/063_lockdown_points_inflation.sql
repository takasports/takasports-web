-- 063_lockdown_points_inflation
-- Cierra las 2 vías de auto-inflado del ranking Liga Taka (puntos).
-- Aplicada vía MCP el 2026-06-08 sobre el proyecto ybjmokuppfcnptyouagr.
--
-- Prerrequisito YA desplegado: /api/games/streak escribe el milestone con
-- service_role (commit c4bf450), así que estas dos clausuras no dejan sin
-- caller legítimo a ninguna escritura del lado cliente. Único insert directo a
-- point_transactions y único caller de increment_points_balance en todo el repo
-- era esa ruta de racha; el stake de quiniela ya iba por spend_points (definer).

-- 1) point_transactions: ya solo escriben award_points/spend_points (SECURITY
--    DEFINER) y service_role. El cliente del usuario no inserta directamente.
--    Se CONSERVA pt_select_own (cada quien lee su propio historial).
DROP POLICY IF EXISTS pt_insert_own ON public.point_transactions;

-- 2) increment_points_balance: helper interno de denormalización del balance.
--    Era SECURITY DEFINER ejecutable por anon/authenticated sin guarda → un POST
--    directo subía points_balance de cualquiera. service_role conserva EXECUTE.
REVOKE EXECUTE ON FUNCTION public.increment_points_balance(uuid, integer) FROM PUBLIC, anon, authenticated;
