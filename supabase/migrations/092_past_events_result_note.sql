-- 092 — Ganador de eventos sin marcador clásico (carreras F1 / veladas UFC
-- pasadas). Espejo de SportEvent.resultNote. Lo rellena el cron
-- sync-past-results vía upsertPastEvents (eventToRow en src/lib/past-events.ts).
-- Nullable: la inmensa mayoría de filas (fútbol, NBA, tenis…) tienen marcador y
-- dejan result_note NULL.
--
-- Aplicada en vivo vía MCP (Supabase project ybjmokuppfcnptyouagr).
-- get_advisors(security) tras el DDL: 0 ERRORES.

alter table public.past_events add column if not exists result_note text;

comment on column public.past_events.result_note is
  'Nombre del ganador para eventos sin marcador (F1/UFC pasados). Espejo de SportEvent.resultNote; lo rellena el cron sync-past-results. NULL para deportes con marcador.';
