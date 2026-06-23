-- 091 · Restringir lectura de miembros de liga a usuarios autenticados.
-- Cierra la fuga de user_id vía PostgREST anónimo
--   (GET /rest/v1/quiniela_league_members?select=user_id  y  ranked_league_members).
--
-- Por qué no rompe nada del servidor:
--   · Las clasificaciones / lecturas de lista completa usan service_role (admin) o un RPC
--     con pid opaco (ranked_league_leaderboard) → saltan RLS.
--   · El detalle de liga / estado se leen con el cliente de SESIÓN del usuario (autenticado)
--     → pasan el nuevo USING.
--   · El chat (migr 087) consulta estas tablas dentro de su RLS como el propio usuario; para
--     un anónimo la RLS ahora filtra a 0 filas (sin error) → el chat de invitado sigue
--     saliendo vacío.
--
-- Efecto de producto ACEPTADO por el dueño: un invitado (sin sesión) ya no ve la lista de
-- participantes de una liga compartida hasta iniciar sesión.
--
-- Aplicada en vivo vía MCP (apply_migration). get_advisors(security): 0 errores.

ALTER POLICY lm_read ON public.quiniela_league_members
  USING ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY rlm_public_read ON public.ranked_league_members
  USING ((SELECT auth.uid()) IS NOT NULL);
