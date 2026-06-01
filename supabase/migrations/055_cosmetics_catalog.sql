-- ─────────────────────────────────────────────────────────────────
-- Cosméticos — catálogo en DB del sistema de personalización.
--
-- Hasta ahora los cosméticos vivían atados a badges en código
-- (src/lib/badges.ts → unlocks: title/frameColor/cardBg). Eso limita:
--   · Cada cosmético nuevo requiere deploy + revisión.
--   · Solo se desbloquean vía badges, no por subir nivel / hitos
--     diversos.
--   · El catálogo está acoplado al catálogo de logros — no se pueden
--     diseñar como sistemas independientes.
--
-- Esta migración crea dos tablas:
--
--   1. cosmetics  → catálogo público de items cosméticos. Admin lo
--                   edita sin deploy. Es la fuente de verdad de
--                   "qué se puede equipar".
--
--   2. user_cosmetic_unlocks → quién ha desbloqueado qué cosmético
--                              y cuándo. Idempotente vía PK.
--
-- La tabla quiniela_user_equipment NO se toca en esta migración —
-- se extenderá en una migración posterior (056) cuando hayamos
-- validado el modelo nuevo.
-- ─────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════
-- 1. CATÁLOGO DE COSMÉTICOS
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.cosmetics (
  id              text primary key,             -- 'frame_pleno_gold', 'name_effect_rainbow'…
  type            text not null check (type in (
                    'badge_chip',     -- chip 16×16 junto al nick
                    'title',          -- epíteto bajo el nick
                    'frame',          -- borde de la fila/placa
                    'card_bg',        -- fondo de la fila/placa
                    'avatar_frame',   -- anillo del avatar
                    'name_effect',    -- gradient/glow sobre el nombre
                    'corner_sticker', -- pegatina decorativa esquina
                    'signature_stat', -- stat firmado destacado
                    'background_pattern' -- textura overlay sutil
                  )),
  name            text not null,                -- "Marco dorado clásico"
  description     text,                         -- flavor text
  rarity          text not null check (rarity in ('common','rare','epic','legendary')),

  -- Datos visuales — varía por type. Ejemplos:
  --   title:        { text: "El Oráculo", color: "#a78bfa" }
  --   frame:        { color: "#fbbf24" }
  --   card_bg:      { gradient: "linear-gradient(...)" }
  --   name_effect:  { gradient: "linear-gradient(...)" }
  --   avatar_frame: { color: "#22d3ee", style: "gradient" }
  --   corner_sticker: { icon_id: "trophy", color: "#fbbf24" }
  --   badge_chip:   { icon_id: "oraculo", color: "#a78bfa", bg: "rgba(...)" }
  data            jsonb not null,

  -- Cómo se consigue
  unlock_source   text not null check (unlock_source in (
                    'badge',       -- al desbloquear un badge específico
                    'level',       -- al alcanzar un nivel
                    'event',       -- al participar en un evento (manual admin)
                    'sport_pick',  -- al elegir un deporte favorito (free)
                    'manual'       -- admin lo otorga 1-a-1
                  )),
  -- Condición concreta — interpretada según unlock_source:
  --   badge:       { badge_id: "oraculo" }
  --   level:       { min_level: 10 }
  --   event:       { event_id: "mundial_2026_finalist" }
  --   sport_pick:  { sport: "futbol" }
  --   manual:      {}
  unlock_condition jsonb not null default '{}'::jsonb,

  -- Metadatos
  season          text,                         -- 'mundial_2026', 'verano_2026' (null = permanente)
  active          boolean not null default true,
  sort_order      int not null default 0,       -- orden en la galería
  created_at      timestamptz not null default now()
);

-- Índices para queries comunes
create index if not exists cosmetics_type_idx          on public.cosmetics(type) where active = true;
create index if not exists cosmetics_unlock_source_idx on public.cosmetics(unlock_source) where active = true;
create index if not exists cosmetics_rarity_idx        on public.cosmetics(rarity) where active = true;

-- RLS: lectura pública (todos pueden ver el catálogo completo),
-- escritura solo service_role (admin via /api/admin/cosmetics futuro).
alter table public.cosmetics enable row level security;

drop policy if exists "cosmetics_read" on public.cosmetics;
create policy "cosmetics_read" on public.cosmetics
  for select using (active = true);

comment on table public.cosmetics is
  'Catálogo de items cosméticos. Admin edita sin redeploy. Lectura pública (vía RLS active=true). Escritura solo service_role.';

-- ══════════════════════════════════════════════════════════════════
-- 2. UNLOCKS POR USUARIO
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.user_cosmetic_unlocks (
  user_id        uuid references auth.users on delete cascade not null,
  cosmetic_id    text references public.cosmetics(id) on delete cascade not null,
  unlocked_at    timestamptz not null default now(),
  -- Copia del unlock_source al momento de otorgar (auditoría) — si
  -- en el futuro el cosmético cambia su unlock_source, queda traza.
  unlock_source  text not null,
  primary key (user_id, cosmetic_id)
);

create index if not exists user_cosmetic_unlocks_user_idx on public.user_cosmetic_unlocks(user_id);

alter table public.user_cosmetic_unlocks enable row level security;

drop policy if exists "ucu_read_own"      on public.user_cosmetic_unlocks;
drop policy if exists "ucu_read_public"   on public.user_cosmetic_unlocks;

-- Lectura pública: necesaria para renderizar la placa de otros users
-- (perfil/[userId], ranking). Análogo a quiniela_badges.
create policy "ucu_read_public" on public.user_cosmetic_unlocks
  for select using (true);

-- INSERT solo service_role (vía RPC unlock_cosmetic o awardCosmetics).
-- No hay policy de INSERT/UPDATE/DELETE → bloqueados para anon/authenticated.

comment on table public.user_cosmetic_unlocks is
  'Cosméticos desbloqueados por cada usuario. PK idempotente (user_id, cosmetic_id). Escritura solo service_role.';

-- ══════════════════════════════════════════════════════════════════
-- 3. RPC unlock_cosmetic — idempotente, retorna si fue nuevo o ya lo tenía
-- ══════════════════════════════════════════════════════════════════
create or replace function public.unlock_cosmetic(
  p_user_id     uuid,
  p_cosmetic_id text,
  p_source      text default null
) returns table (
  was_new       boolean,
  cosmetic_id   text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
  v_inserted boolean := false;
begin
  -- Validar que el cosmético existe y está activo
  select unlock_source into v_source
  from public.cosmetics
  where id = p_cosmetic_id and active = true;

  if v_source is null then
    return query select false as was_new, p_cosmetic_id::text;
    return;
  end if;

  -- Idempotente: si ya lo tenía, no hace nada
  insert into public.user_cosmetic_unlocks (user_id, cosmetic_id, unlock_source)
  values (p_user_id, p_cosmetic_id, coalesce(p_source, v_source))
  on conflict (user_id, cosmetic_id) do nothing;

  -- ¿Fue nuevo? Comprobamos si la fila se acaba de crear
  v_inserted := found;

  return query select v_inserted as was_new, p_cosmetic_id::text;
end;
$$;

revoke all on function public.unlock_cosmetic(uuid, text, text) from public;
grant execute on function public.unlock_cosmetic(uuid, text, text) to service_role;

comment on function public.unlock_cosmetic is
  'Otorga un cosmético a un user. Idempotente. Solo service_role. Devuelve was_new=true si fue desbloqueado en esta llamada.';
