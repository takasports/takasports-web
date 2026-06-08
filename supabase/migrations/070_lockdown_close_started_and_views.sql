-- 070 — Blindaje BD Fase 4 (parte SQL post-deploy).
--
-- (A) close_started_ranked_events(): era ejecutable por anon/authenticated
--     (advisor 0028/0029). Los 3 callers (ranked/events, cron/sync-ufc,
--     cron/sync-mundial) ya pasaron al cliente admin (service_role) en el
--     commit 1a2155a, vivo en prod. REVOKE de anon/authenticated.
--
-- (B) 3 vistas SECURITY DEFINER → INVOKER (advisor 0010). VERIFICADO que sus
--     tablas base tienen lectura pública equivalente → INVOKER devuelve las
--     MISMAS filas (no rompe nada):
--       · ranking_view                    (ranking_entries: USING active=true,
--                                           y la vista ya filtra WHERE active=true)
--       · ranking_edits_narrative_outliers(ranking_edits: USING true)
--       · index_predictions_leaderboard   (index_predictions: USING true)
--     SET (security_invoker = on) conserva el cuerpo de la vista intacto.
--
--     NO se tocan entry_favorites_count ni weekly_poll_results: cuentan
--     votos/favoritos de TODOS pero sus tablas base solo permiten leer lo
--     propio (auth.uid()=user_id) → son DEFINER A PROPÓSITO para exponer
--     recuentos públicos (solo números, sin datos personales). INVOKER las
--     rompería (cada user vería solo su voto).

REVOKE EXECUTE ON FUNCTION public.close_started_ranked_events() FROM anon, authenticated;

ALTER VIEW public.ranking_view                     SET (security_invoker = on);
ALTER VIEW public.ranking_edits_narrative_outliers SET (security_invoker = on);
ALTER VIEW public.index_predictions_leaderboard    SET (security_invoker = on);
