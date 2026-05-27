-- ─────────────────────────────────────────────────────────────────
-- 038_special_badges.sql
--
-- Badges ESPECIALES — limitados en tiempo y/o número, definidos por
-- admin por jornada. Pensados para eventos puntuales:
--   · "El Clásico" badge para quien acierte el resultado del Real vs Barça
--   · "Primera jornada del Mundial" para quien selle antes del kickoff
--   · "Sorpresa de la jornada" para top N que más coins ganen
--
-- A diferencia de los badges del catálogo (src/lib/badges.ts) que viven
-- en código, estos viven 100% en DB porque su creación es operativa
-- (no requiere deploy).
--
-- La concesión sigue usando la tabla existente quiniela_badges (un user
-- recibe un badge_id, idempotente por PK user_id+badge_id). El badge_id
-- de los especiales tiene prefijo "sp_" para distinguirlos en UI/queries.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.quiniela_special_badges (
  badge_id        text primary key,        -- ej. "sp_clasico_2026_01"
  name            text not null,           -- "El Clásico"
  emoji           text not null,           -- "⚔️"
  color           text not null,           -- "#fbbf24"
  bg              text not null,           -- "rgba(251,191,36,0.14)"
  description     text not null,
  rarity          text not null default 'rare' check (rarity in ('common','rare','epic','legendary')),
  -- Scope del badge ──────────────────────────────────────────────
  jornada         text,                    -- jornada exacta que dispara el badge (null = cualquier jornada matching el criterio)
  -- Criterio de concesión:
  --   'top_n'             → top N del ranking de la jornada por monedas (criteria_value = N)
  --   'min_hits'          → mínimo de aciertos en la jornada (criteria_value = N)
  --   'pleno'             → quien haga pleno de la jornada (criteria_value ignorado)
  --   'all_participants'  → todos los que sellaron stake > 0 (criteria_value ignorado)
  --   'manual'            → solo se otorga por endpoint manual del admin (no auto)
  criteria_type   text not null check (criteria_type in ('top_n','min_hits','pleno','all_participants','manual')),
  criteria_value  int default 0,
  -- Caps y expiración ───────────────────────────────────────────
  max_grants      int default 0,           -- 0 = ilimitado
  granted_count   int default 0,           -- counter actualizado al otorgar
  expires_at      timestamptz,             -- null = nunca expira (badge permanente)
  active          boolean default true,    -- soft-disable sin perder histórico
  created_at      timestamptz default now()
);

create index if not exists qsb_active_jornada on public.quiniela_special_badges(active, jornada) where active = true;

-- RLS: lectura pública (necesaria para leaderboard/HitosModal)
alter table public.quiniela_special_badges enable row level security;
drop policy if exists "qsb_read" on public.quiniela_special_badges;
create policy "qsb_read" on public.quiniela_special_badges for select using (true);
-- write solo service role (sin policy)
