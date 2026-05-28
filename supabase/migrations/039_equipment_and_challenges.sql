-- ─────────────────────────────────────────────────────────────────
-- 039_equipment_and_challenges.sql
--
-- Dos extensiones al sistema de badges:
--
-- 1. EQUIPAMIENTO (quiniela_user_equipment)
--    Cada user puede "equipar" activamente los ítems que desbloqueó
--    en 4 slots: badge principal, título/epíteto, frame de fila, y
--    card_bg (fondo de su fila — solo legendary). El equipamiento es
--    visible públicamente en el ranking.
--
-- 2. DESAFÍOS SEMANALES (extensión de quiniela_special_badges)
--    Los special badges pueden ser "desafíos" — con coin_bonus,
--    visible en sidebar para todos (incluso no-autenticados), y con
--    un flujo de claim manual (el user recibe un popup al completarlo
--    y tiene que hacer click para acreditar). Evita que la recompensa
--    se sienta invisible.
--
--    quiniela_challenge_completions guarda el estado de completado
--    vs reclamado por user+challenge+jornada.
-- ─────────────────────────────────────────────────────────────────

-- ── SLOT SYSTEM ──────────────────────────────────────────────────
-- Slots disponibles:
--   'badge'    → ícono chip junto al nick en el ranking
--   'title'    → epíteto bajo el nick ("El Oráculo")
--   'frame'    → color del borde de la fila (epic+)
--   'card_bg'  → gradiente del fondo de la fila (legendary only)

create table if not exists public.quiniela_user_equipment (
  user_id   uuid references auth.users on delete cascade not null,
  slot      text not null check (slot in ('badge','title','frame','card_bg')),
  badge_id  text not null,   -- el badge que otorgó este ítem
  updated_at timestamptz default now(),
  primary key (user_id, slot)
);

alter table public.quiniela_user_equipment enable row level security;

drop policy if exists "eq_read"   on public.quiniela_user_equipment;
drop policy if exists "eq_write"  on public.quiniela_user_equipment;

-- Lectura pública (para renderizar en ranking de otros usuarios)
create policy "eq_read"  on public.quiniela_user_equipment for select using (true);
-- Escritura solo por el propio user
create policy "eq_write" on public.quiniela_user_equipment for all using (auth.uid() = user_id);

create index if not exists qeq_user on public.quiniela_user_equipment(user_id);

-- ── CHALLENGE COMPLETIONS ─────────────────────────────────────────
-- Cuando el settle detecta que un user cumplió las condiciones de un
-- desafío, inserta aquí con claimed_at=null. Cuando el user reclama,
-- se actualiza claimed_at. La acreditación de coins ocurre en el claim.

create table if not exists public.quiniela_challenge_completions (
  user_id      uuid references auth.users on delete cascade not null,
  badge_id     text not null,           -- references quiniela_special_badges.badge_id
  jornada      text not null,
  completed_at timestamptz default now(),
  claimed_at   timestamptz,             -- null = pendiente de claim
  coins_awarded int default 0,          -- snapshot del bonus que se acreditó
  primary key (user_id, badge_id, jornada)
);

alter table public.quiniela_challenge_completions enable row level security;

drop policy if exists "qcc_self" on public.quiniela_challenge_completions;
create policy "qcc_self" on public.quiniela_challenge_completions
  for all using (auth.uid() = user_id);

create index if not exists qcc_unclaimed on public.quiniela_challenge_completions(user_id, claimed_at)
  where claimed_at is null;

-- ── EXTENSIONES A quiniela_special_badges ────────────────────────
-- Añadir columnas para los desafíos con display y coin bonus.
-- Idempotente: usa 'if not exists' pattern vía column check.

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='quiniela_special_badges' and column_name='coin_bonus'
  ) then
    alter table public.quiniela_special_badges add column coin_bonus int default 0;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name='quiniela_special_badges' and column_name='show_in_sidebar'
  ) then
    alter table public.quiniela_special_badges add column show_in_sidebar boolean default false;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name='quiniela_special_badges' and column_name='challenge_title'
  ) then
    alter table public.quiniela_special_badges add column challenge_title text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name='quiniela_special_badges' and column_name='challenge_description'
  ) then
    alter table public.quiniela_special_badges add column challenge_description text;
  end if;
end $$;
