-- 135 · Cerrar tres puertas que el cliente (clave anónima) tenía abiertas.
--
-- 1. profiles: la política profiles_self (ALL sobre la fila propia) y el GRANT
--    de tabla completa dejaban a cualquier usuario con sesión cambiarse
--    points_balance —que cuenta en las clasificaciones de las ligas— y
--    oculto_en_clasificaciones desde el navegador. El cliente solo necesita
--    escribir su nombre, avatar y zona horaria (perfil y callback de OAuth).
--    Los puntos los mueven funciones SECURITY DEFINER y el service role, que no
--    dependen de estos permisos.
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, display_name, avatar_url, timezone) ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, timezone) ON public.profiles TO authenticated;
REVOKE DELETE, TRUNCATE ON public.profiles FROM anon, authenticated;

-- 2. push_subscriptions: `OR user_id IS NULL` dejaba a cualquiera, sin sesión,
--    leer y borrar las suscripciones anónimas con sus claves de envío. Desde
--    ahora /api/push/subscribe escribe con service role; el cliente solo ve
--    las suyas.
DROP POLICY IF EXISTS psub_self ON public.push_subscriptions;
CREATE POLICY psub_self ON public.push_subscriptions
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
REVOKE ALL ON public.push_subscriptions FROM anon;
REVOKE TRUNCATE ON public.push_subscriptions FROM authenticated;

-- 3. Dos procesos pesados que cualquiera podía lanzar por la API REST.
--    Los llaman el panel de rankings (service role) y los scripts del pipeline.
REVOKE EXECUTE ON FUNCTION public.refresh_source_reliability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_sync_creator_scores() FROM PUBLIC, anon, authenticated;
