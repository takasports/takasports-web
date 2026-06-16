-- 078 — Rendimiento RLS (Supabase lint auth_rls_initplan): envolver las
-- llamadas auth.uid()/auth.role()/auth.jwt() de las políticas en (select ...)
-- para que se evalúen UNA vez por consulta en vez de por fila. Misma lógica de
-- seguridad (semánticamente idéntico), mejor rendimiento al crecer la tabla.
-- Solo toca políticas con llamadas "desnudas" (sin envolver). Atómico.
-- Aplicada en Supabase vía MCP el 2026-06-16 (42 políticas reescritas).
DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual ~ 'auth\.(uid|jwt|role)\(\)' AND qual !~ 'select auth\.')
        OR (with_check ~ 'auth\.(uid|jwt|role)\(\)' AND with_check !~ 'select auth\.')
      )
  LOOP
    new_qual := r.qual;
    new_check := r.with_check;
    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, 'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, 'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
    END IF;
    stmt := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;
    EXECUTE stmt;
  END LOOP;
END $$;
