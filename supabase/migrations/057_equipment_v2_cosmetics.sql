-- ─────────────────────────────────────────────────────────────────
-- Equipment v2 — extender quiniela_user_equipment para soportar el
-- sistema de cosmetics (no solo badges).
--
-- Cambios (todos aditivos, sin destructivo):
--
--   1. Añadir columna `cosmetic_id` text nullable, FK a cosmetics.id.
--      Cuando está presente, el equipment se resuelve desde el catálogo
--      en DB. Cuando es null, el equipment se resuelve desde el catálogo
--      en código (BADGES en src/lib/badges.ts, vía badge_id) — flujo
--      legacy que sigue funcionando.
--
--   2. Relajar el CHECK de `slot` para aceptar los 5 nuevos slots:
--      avatar_frame, name_effect, corner_sticker, signature_stat,
--      background_pattern. Los nuevos slots SOLO aceptan cosmetic_id
--      (no badge_id), porque no existe badge equivalente.
--
--   3. CHECK: exactamente uno de (badge_id, cosmetic_id) debe estar
--      presente — no ambos, no ninguno.
--
-- Filas existentes con badge_id no se tocan. Quien quiera equipar
-- los nuevos slots, debe usar cosmetic_id (vía nuevo endpoint /api/
-- cosmetics/equip).
-- ─────────────────────────────────────────────────────────────────

-- 1. Añadir cosmetic_id (nullable, FK a cosmetics)
alter table public.quiniela_user_equipment
  add column if not exists cosmetic_id text references public.cosmetics(id) on delete cascade;

-- 2. Relajar CHECK de slot — drop el viejo, crear el nuevo
alter table public.quiniela_user_equipment
  drop constraint if exists quiniela_user_equipment_slot_check;

alter table public.quiniela_user_equipment
  add constraint quiniela_user_equipment_slot_check
  check (slot in (
    -- Legacy 4 slots (badge_id o cosmetic_id)
    'badge', 'title', 'frame', 'card_bg',
    -- Nuevos 5 slots (solo cosmetic_id)
    'avatar_frame', 'name_effect', 'corner_sticker',
    'signature_stat', 'background_pattern'
  ));

-- 3. CHECK exactly-one: exactamente uno de los dos debe estar set
alter table public.quiniela_user_equipment
  drop constraint if exists equipment_one_source_check;

alter table public.quiniela_user_equipment
  add constraint equipment_one_source_check
  check (
    (badge_id is not null and cosmetic_id is null) or
    (badge_id is null and cosmetic_id is not null)
  );

-- 4. Hacer badge_id nullable (era NOT NULL en la tabla original)
alter table public.quiniela_user_equipment
  alter column badge_id drop not null;

-- 5. Índice para queries de cosmetic_id (e.g. "cuántos users equipan X")
create index if not exists quiniela_user_equipment_cosmetic_idx
  on public.quiniela_user_equipment(cosmetic_id)
  where cosmetic_id is not null;

comment on column public.quiniela_user_equipment.cosmetic_id is
  'FK a cosmetics(id) — modo cosmetic (DB catalog). Mutuamente excluyente con badge_id.';
comment on column public.quiniela_user_equipment.badge_id is
  'badge_id legacy del catálogo en código (src/lib/badges.ts). Mutuamente excluyente con cosmetic_id.';
