-- Índice que faltaba en sport_entities(sport, espn_id).
--
-- La 106 creó la tabla con índices por (type, sport), apisports_id y tm_player_id,
-- pero NO por espn_id — que es justo por donde pregunta la ruta más caliente del
-- sitio. getPhotosByEspnId() hace:
--
--   select espn_id, sport_entity_images!inner(...)
--     from sport_entities where sport = $1 and espn_id in ($2..$300)
--
-- y la sirven /api/stats/players, /api/jugador/[slug] y /api/team/[slug]. El índice
-- (type, sport) no cubre esa consulta: type no aparece en el WHERE, así que Postgres
-- no puede usar la columna guía y cae a seq scan. Con la tabla ya en ~53.000 filas,
-- cada petición barría la tabla entera, 300 ids a la vez, unas 160.000 veces al día.
--
-- El 18/08/2026 eso saturó Postgres hasta el punto de que PostgREST no lograba ni
-- cargar su schema cache: la API REST devolvía 522/503, y con ella se cayó TODO el
-- pipeline editorial (n8n WF-01..WF-08 fallaban con "error code: 522" al leer
-- content_items), así que dejaron de llegar las noticias a Telegram.
--
-- Aditivo y reversible: drop index sport_entities_sport_espn_idx.

create index if not exists sport_entities_sport_espn_idx
  on public.sport_entities (sport, espn_id);
