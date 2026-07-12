-- 105_create_traffic_daily.sql
-- Foto diaria de tráfico web + app: GA4 (visitas) + Search Console (búsqueda) +
-- descargas iOS (App Store Connect). La escribe taka-system/scripts/taka-daily-report.mjs
-- (launchd com.taka.daily-report, 9:15) con service_role; la lee /admin/trafico.
-- Da el HISTÓRICO persistente (tendencias a meses) y la única vía de las descargas
-- iOS en la web (la .p8 de Apple no viaja a Vercel). Una fila por día.
--
-- Ya aplicada en producción vía MCP (migración `create_traffic_daily`, 2026-07-12);
-- este fichero la versiona en el repo. Idempotente.

create table if not exists public.traffic_daily (
  day                      date primary key,
  captured_at              timestamptz not null default now(),
  -- Web · GA4
  ga_users_yesterday       integer,
  ga_users_avg7            integer,
  ga_organic_pct           integer,
  -- Web · Search Console (ventana 7d actual)
  gsc_clicks               integer,
  gsc_impressions          integer,
  gsc_position             numeric(5,2),
  -- App · iOS (App Store Connect)
  ios_downloads_yesterday  integer,
  ios_downloads_7d         integer,
  ios_downloads_total      integer,
  -- Snapshot completo del informe diario {web, news, tech, app} por flexibilidad
  raw                      jsonb
);

comment on table public.traffic_daily is 'Foto diaria de trafico web+app (GA4 + Search Console + descargas iOS). La escribe taka-system (daily-report, 9:15) con service_role; la lee /admin/trafico. Una fila por dia.';

alter table public.traffic_daily enable row level security;

-- Sin politicas: solo el backend (service_role) y el panel admin (service_role)
-- acceden. anon/authenticated quedan denegados por defecto (dato global, no de usuario).
