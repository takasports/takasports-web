-- 090_mionce_lineups_client_id
-- El id del once lo genera el cliente (mismo id en local y servidor) → la
-- sincronización web↔app es exacta sin reconciliar uuids. Tabla recién creada
-- en 089 y vacía. PK pasa a (user_id, id): los ids solo deben ser únicos por
-- usuario. Aplicada vía MCP el 2026-06-22.
alter table public.user_mionce_lineups drop constraint user_mionce_lineups_pkey;
alter table public.user_mionce_lineups alter column id drop default;
alter table public.user_mionce_lineups alter column id type text using id::text;
alter table public.user_mionce_lineups add primary key (user_id, id);
