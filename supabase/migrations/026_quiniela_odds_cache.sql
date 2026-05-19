-- ─────────────────────────────────────────────────────────────────
-- 026 — Caché compartida de cuotas (the-odds-api)
-- En serverless (Vercel) cada instancia tiene su propio Map en
-- memoria; los arranques en frío del Mundial reventaban el free
-- tier de the-odds-api porque cada cold start recachaba. Con esta
-- tabla las instancias comparten una sola caché → ~240 req/mes
-- y nunca se queda sin línea (stale-on-failure desde el route).
-- Solo el server (service role) escribe/lee; RLS habilitado sin
-- políticas → bloquea anon/authenticated por defecto.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.quiniela_odds_cache (
  odds_key  text primary key,
  events    jsonb not null default '[]'::jsonb,
  ts        timestamptz not null default now(),
  empty     boolean not null default false
);

alter table public.quiniela_odds_cache enable row level security;
-- Sin policies = inaccesible para anon/authenticated; service_role bypassea RLS.

comment on table public.quiniela_odds_cache is
  'Caché compartida de cuotas the-odds-api por oddsKey (3h TTL OK, 20min empty, stale-on-failure).';
