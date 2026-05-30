-- Lista de espera para Ranked UFC.
-- Sin RLS pública; solo service_role puede leer/insertar.

CREATE TABLE IF NOT EXISTS ufc_waitlist (
  email      text PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL
);

REVOKE ALL ON TABLE ufc_waitlist FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE ufc_waitlist TO service_role;
