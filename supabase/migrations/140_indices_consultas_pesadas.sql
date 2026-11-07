-- La caída del 06/11/2026 (23:00-00:15, hora de España): tras cada despliegue
-- todas las noticias se regeneran y buscaban jugadores por nombre recorriendo
-- las 30.000 filas de sport_entities. Son las consultas que más tiempo de base
-- de datos consumen, junto con tres del robot sobre content_items.
create index if not exists sport_entities_type_name_idx
  on public.sport_entities (type, name);
create index if not exists sport_entities_name_trgm_idx
  on public.sport_entities using gin (name extensions.gin_trgm_ops);

create index if not exists idx_content_items_telegram_sin_notificar
  on public.content_items (telegram_message_id) where notified_at is null;
create index if not exists idx_content_items_sin_puntuar
  on public.content_items (created_at desc) where enriched_at is not null and score is null;
create index if not exists idx_content_items_por_notificar
  on public.content_items (score desc) where enriched_at is not null and score is not null and notified_at is null;
