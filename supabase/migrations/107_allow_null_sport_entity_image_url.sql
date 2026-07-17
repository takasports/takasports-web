-- Fase 0.3 — El resolver (src/lib/entity-images.ts) persiste también los MISS con
-- status='missing': sin eso, cada pasada del cron volvería a pedir las mismas 404
-- de los jugadores que no tienen foto en NINGUNA fuente, que son mayoría en ligas
-- menores. En un miss no hay url, así que la columna debe admitir null; a cambio,
-- exigimos que exista cuando status='ok'.

alter table sport_entity_images alter column url drop not null;

alter table sport_entity_images
  add constraint sport_entity_images_url_required_when_ok
  check (status <> 'ok' or url is not null);
