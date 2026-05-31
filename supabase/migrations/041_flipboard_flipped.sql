-- Tabla para trackear artículos ya flippeados a Flipboard
CREATE TABLE IF NOT EXISTS flipboard_flipped (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_url TEXT UNIQUE NOT NULL,
  article_title TEXT,
  flipped_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsquedas rápidas por URL
CREATE INDEX IF NOT EXISTS idx_flipboard_flipped_url ON flipboard_flipped(article_url);

-- RLS: solo service_role puede escribir
ALTER TABLE flipboard_flipped ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON flipboard_flipped
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
