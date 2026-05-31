-- Cierra exposición: anon key podía leer/escribir emails de waitlist UFC.
-- La API /api/ranked/ufc-waitlist usa service_role (adminSupabase), que
-- bypassa RLS, por lo que no necesitamos policies para que siga funcionando.
-- Sin policies + RLS enabled = anon/authenticated bloqueados.
ALTER TABLE public.ufc_waitlist ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ufc_waitlist IS
  'Lista de espera Ranked UFC. RLS enabled sin policies — acceso solo vía service_role desde /api/ranked/ufc-waitlist.';
