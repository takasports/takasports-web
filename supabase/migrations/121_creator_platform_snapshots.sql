-- 121_creator_platform_snapshots.sql
-- Fotos periódicas de cada perfil por plataforma.
--
-- ── POR QUÉ ──────────────────────────────────────────────────────
-- El Crecimiento pesa un 25% del score de Contenido y salía del número de
-- vídeos publicados en 30 días. Ese dato lo da YouTube, pero 85 de los 165
-- perfiles no tienen canal: viven en TikTok, y TikTok solo publica el TOTAL de
-- vídeos de toda la vida del perfil, que no sirve para medir actividad
-- reciente. Se quedaban en el valor por defecto.
--
-- Restando dos fotos separadas en el tiempo sí sale: si el lunes tenía 590
-- vídeos y el jueves 598, publicó 8 en tres días. Eso es actividad real.
--
-- La tabla guarda también los seguidores, que hoy no se usan para nada pero son
-- el ingrediente del crecimiento de AUDIENCIA — el día que queramos medir «va
-- de menos a más» en vez de solo «publica mucho», el histórico ya estará ahí.
-- Empezar a guardarlo cuesta cero y no tenerlo cuesta semanas de espera.
create table if not exists creator_platform_snapshots (
  id           bigserial   primary key,
  creator_id   text        not null,
  red          text        not null,
  seguidores   bigint,
  videos       int,
  captured_at  timestamptz not null default now()
);

create index if not exists creator_platform_snapshots_busqueda
  on creator_platform_snapshots (creator_id, red, captured_at desc);

-- Una foto por perfil y día: si el pipeline se relanza a mano, no se duplica.
-- `captured_at::date` sobre timestamptz depende de la zona horaria de la sesión
-- y Postgres no lo acepta en un índice; fijarla a UTC lo vuelve inmutable.
create unique index if not exists creator_platform_snapshots_una_por_dia
  on creator_platform_snapshots (creator_id, red, ((captured_at at time zone 'UTC')::date));

comment on table creator_platform_snapshots is
  'Fotos periódicas de seguidores y número de vídeos por plataforma. TikTok solo da el TOTAL de vídeos, no los del último mes: restando dos fotos sale la actividad real. Lo escribe scripts/ingest-tiktok-engagement.mjs.';

alter table creator_platform_snapshots enable row level security;

drop policy if exists "service_role gestiona snapshots de plataforma" on creator_platform_snapshots;
create policy "service_role gestiona snapshots de plataforma"
  on creator_platform_snapshots for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
