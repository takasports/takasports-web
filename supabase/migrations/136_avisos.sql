-- 136 · Avisos: «tu equipo juega hoy», «resultado final» y noticias por deporte.
--
-- Los avisos existían a medias: la web suscribía navegadores a `noticias` y
-- `noticias:<deporte>` y nadie emitía esos temas, y el aviso de favoritos
-- cruzaba con jugadores del Índice cuando lo que la gente marca son equipos.
-- Esta migración da a los emisores nuevos (lib/avisos-*) dónde apuntar lo que
-- ya han mandado, y a la app un sitio donde guardar sus temas.
--
-- Todo se escribe con service role desde el servidor: ninguna de las tablas
-- nuevas tiene política para el cliente.

-- 1. Temas en los tokens de la APP ───────────────────────────────────────────
--    Hasta ahora `push_tokens` no tenía temas: cualquier envío «por tema» o iba
--    a todos los móviles o a ninguno. Con esta columna, un envío a
--    `noticias:futbol` llega a los navegadores Y a los móviles que la pidieron.
--    Por defecto vacío: los tokens que ya existen NO reciben nada nuevo por
--    tema hasta que la app los apunte (los avisos personales —sendPushToUser—
--    no miran temas y siguen igual).
--    `user_id` ya admite NULL (comprobado el 03/10/2026): el registro sin
--    sesión (/api/app/push-token) no necesita tocarlo.
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS topics text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS push_tokens_topics_idx
  ON public.push_tokens USING gin (topics);

-- 2. Registro de avisos de EQUIPO (uno por usuario + tipo + referencia) ─────
--    kind = 'equipo_hoy'   → ref = día local 'YYYY-MM-DD' (un aviso al día)
--    kind = 'equipo_final' → ref = id del partido (un resultado por partido)
--    La PK es la idempotencia: el cron reclama la fila ANTES de enviar
--    (insert ... on conflict do nothing) y solo envía a lo recién reclamado.
--    Mejor perder un aviso que mandarlo dos veces.
CREATE TABLE IF NOT EXISTS public.avisos_equipo_log (
  user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind     text        NOT NULL CHECK (kind IN ('equipo_hoy', 'equipo_final')),
  ref      text        NOT NULL,
  sent_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, ref)
);
CREATE INDEX IF NOT EXISTS avisos_equipo_log_sent_at_idx
  ON public.avisos_equipo_log (sent_at);
ALTER TABLE public.avisos_equipo_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.avisos_equipo_log FROM anon, authenticated;

-- 3. Registro de avisos de NOTICIAS (uno por artículo y tema, tope 2/día) ──
--    El tope de 2 avisos por tema y día lo hace la base de datos, no un
--    contador en memoria: cada aviso reclama una «plaza» (slot 1 o 2) del día
--    y la restricción única impide que dos webhooks simultáneos se queden la
--    misma. Sin plaza libre, no se avisa.
--    `madrid_day` es el día en Madrid (hora Taka), como el resto de topes.
CREATE TABLE IF NOT EXISTS public.avisos_noticias_log (
  article_id  text        NOT NULL,
  topic       text        NOT NULL,
  madrid_day  date        NOT NULL,
  slot        smallint    NOT NULL CHECK (slot BETWEEN 1 AND 2),
  title       text,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, topic),
  UNIQUE (topic, madrid_day, slot)
);
ALTER TABLE public.avisos_noticias_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.avisos_noticias_log FROM anon, authenticated;
