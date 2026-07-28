-- 117_ranking_manual_backup.sql
-- Copia de seguridad de los `score_manual` retirados.
--
-- Contexto: `ranking_view.score` es COALESCE(score_manual, score_auto), así que
-- un `score_manual` anula por completo la fórmula. 40 de los 103 creadores
-- activos tenían uno, sembrado entre 2026-05-19 y 2026-06-12 y SIN nota — es
-- decir, todo el scoring objetivo de creadores (migración 111, f_sync, audiencia,
-- crecimiento, relevancia) no movía nada en el producto para la cabeza de la
-- lista. Ningún deportista tenía score_manual (0 de 970): era exclusivo de
-- creadores, resto de la siembra inicial.
--
-- Se retiraron para que mande la fórmula. Los valores se guardan aquí en vez de
-- en `editorial_note` porque la ficha pinta un badge «✎ NOTA» en cuanto hay
-- nota: 40 creadores aparecían marcados como si tuvieran criterio editorial
-- detrás cuando lo que había era una copia de seguridad.

create table if not exists ranking_manual_backup (
  id            text        not null,
  category      text        not null,
  score_manual  numeric,
  rank_manual   integer,
  seeded_at     timestamptz,
  backed_up_at  timestamptz not null default now(),
  reason        text,
  primary key (id, category, backed_up_at)
);

comment on table ranking_manual_backup is
  'Valores de score_manual/rank_manual retirados, por si hay que restaurarlos. Restaurar = volver a escribirlos en ranking_entries.';

alter table ranking_manual_backup enable row level security;

-- Solo el service_role (los scripts del pipeline y el panel admin). Nada público.
drop policy if exists "service_role manages manual backups" on ranking_manual_backup;
create policy "service_role manages manual backups"
  on ranking_manual_backup for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
