-- 084 — Eliminar la tabla muerta del modelo de apuestas retirado.
--
-- quiniela_featured_picks pertenece al viejo modelo de monedas/apuestas, ya
-- desmantelado (migraciones 047/067/068 + refactor de scoring a solo-puntos).
-- Estado al borrar: 0 filas, sin FKs entrantes (ninguna otra tabla la
-- referencia), solo su propio trigger qfp_updated_at y 4 políticas RLS
-- (qfp_read/qfp_insert/qfp_update_self/qfp_delete_self), que caen con ella.
--
-- El código en vivo dejó de consultarla en el commit 2598aa1 (se retiró de la
-- lista de tablas del export de cuenta /api/account/export), desplegado y
-- verificado en producción ANTES de aplicar este DROP.
--
-- Aplicada vía MCP y verificada: to_regclass → null, 0 triggers, 0 políticas,
-- get_advisors(security) sin errores nuevos.

DROP TABLE IF EXISTS public.quiniela_featured_picks CASCADE;
