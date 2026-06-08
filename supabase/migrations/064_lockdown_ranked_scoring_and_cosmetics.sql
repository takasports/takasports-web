-- 064_lockdown_ranked_scoring_and_cosmetics
-- Cierra 2 funciones SECURITY DEFINER que mutaban estado con parámetros del
-- llamador y eran ejecutables por anon/authenticated.
-- Aplicada vía MCP el 2026-06-08 sobre ybjmokuppfcnptyouagr.

-- 1) score_ufc_prediction(text,text,text): resolvía un evento UFC con
--    winner/method ARBITRARIOS del llamador y autoacreditaba puntos
--    (falsificación de resultado + inflado del ranking). Único caller legítimo
--    = cron/sync-ufc vía admin; service_role conserva EXECUTE.
REVOKE EXECUTE ON FUNCTION public.score_ufc_prediction(text, text, text) FROM PUBLIC, anon, authenticated;

-- 2) unlock_cosmetic(uuid,text,text): desbloqueaba cualquier cosmético para
--    cualquier user (toma p_user_id, sin validar entitlement). RPC legacy SIN
--    caller en el repo (el unlock real va por upsert server-side).
REVOKE EXECUTE ON FUNCTION public.unlock_cosmetic(uuid, text, text) FROM PUBLIC, anon, authenticated;
