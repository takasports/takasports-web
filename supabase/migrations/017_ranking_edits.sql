-- ─────────────────────────────────────────────────────────────────
-- 017 — ranking_edits (audit trail editorial)
-- Registra TODO cambio editorial sobre ranking_entries hecho vía
-- POST/DELETE /api/rankings/override. Permite:
--   · Página /admin/rankings-audit con histórico de ediciones.
--   · Identificar outliers (mover narrativa ±10 sin justificación).
--   · Recuperar el "por qué" de cualquier ajuste meses después.
-- Aplicar en: Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.ranking_edits (
  id          bigserial primary key,
  entry_id    text         not null,
  category    text         not null,
  field       text         not null,        -- 'narrativa_manual', 'editorial_boost', etc.
  old_value   jsonb,                        -- valor previo (puede ser null)
  new_value   jsonb,                        -- valor nuevo (null si DELETE)
  reason      text,                         -- editorialNote o motivo dado por el editor
  edited_by   text,                         -- token hash o identificador (sin secretos en claro)
  edited_at   timestamptz  not null default now()
);

create index if not exists ranking_edits_entry_idx
  on public.ranking_edits (entry_id, category, edited_at desc);

create index if not exists ranking_edits_recent_idx
  on public.ranking_edits (edited_at desc);

create index if not exists ranking_edits_field_idx
  on public.ranking_edits (field, edited_at desc);

-- ── RLS — lectura pública (transparencia), escritura solo service_role ─
alter table public.ranking_edits enable row level security;

drop policy if exists "ranking_edits_read" on public.ranking_edits;
create policy "ranking_edits_read"
  on public.ranking_edits for select using (true);

-- ── Vista útil: outliers narrativos (cambios >= 5 puntos en narrativa) ──
create or replace view public.ranking_edits_narrative_outliers as
select
  e.entry_id,
  e.category,
  e.field,
  (e.old_value)::text  as old_value,
  (e.new_value)::text  as new_value,
  abs((e.new_value)::numeric - coalesce((e.old_value)::numeric, 50)) as delta,
  e.reason,
  e.edited_at
from public.ranking_edits e
where e.field in ('narrativa_manual', 'editorial_boost')
  and e.new_value is not null
  and abs((e.new_value)::numeric - coalesce((e.old_value)::numeric, 50)) >= 5
order by e.edited_at desc;
