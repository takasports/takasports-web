-- 119_ranking_research_jobs.sql
-- Cola de encargos de investigación para el panel de rankings.
--
-- ── POR QUÉ EXISTE ───────────────────────────────────────────────
-- El panel da de alta a alguien investigándolo solo: Wikidata da su identidad y
-- sus perfiles oficiales, la API de YouTube sus suscriptores y su engagement, y
-- TikTok su número de seguidores por HTTP plano.
--
-- Instagram no. Sirve una cáscara de JavaScript: un `fetch` recibe 614 KB sin
-- un solo dato del perfil, y su endpoint interno responde 400 sin sesión. Hace
-- falta un navegador de verdad, y un navegador no corre en Vercel.
--
-- Así que el panel deja aquí el encargo y lo resuelve el Mac, que es donde ya
-- vive el pipeline semanal (launchd com.taka.weekly-rankings-update) y donde ya
-- está Playwright instalado. El worker es scripts/research-worker.mjs.
--
-- Mientras el encargo está pendiente la ficha ya existe y ya puntúa con el
-- resto de plataformas; Instagram solo la completa.

create table if not exists ranking_research_jobs (
  id           uuid        primary key default gen_random_uuid(),
  -- (entry_id, category) es la PK compuesta de ranking_entries: el mismo id
  -- puede ser otra persona en otra categoría, así que hacen falta las dos.
  entry_id     text        not null,
  category     text        not null,
  red          text        not null default 'instagram',
  handle       text        not null,
  estado       text        not null default 'pendiente'
                 check (estado in ('pendiente', 'hecho', 'error')),
  resultado    jsonb,
  error        text,
  intentos     int         not null default 0,
  creado_en    timestamptz not null default now(),
  resuelto_en  timestamptz
);

-- El worker pregunta siempre por lo pendiente y por orden de llegada.
create index if not exists ranking_research_jobs_pendientes
  on ranking_research_jobs (estado, creado_en)
  where estado = 'pendiente';

-- Un encargo vivo por perfil: si se vuelve a dar de alta antes de que el worker
-- pase, no se encolan dos veces.
create unique index if not exists ranking_research_jobs_unico_pendiente
  on ranking_research_jobs (entry_id, category, red)
  where estado = 'pendiente';

comment on table ranking_research_jobs is
  'Encargos que el panel no puede resolver desde Vercel (Instagram necesita navegador). Los vacía scripts/research-worker.mjs en el Mac.';

alter table ranking_research_jobs enable row level security;

-- Solo el service_role: el panel escribe desde una API route con esa clave y el
-- worker lee con la misma. Nada público.
drop policy if exists "service_role gestiona encargos" on ranking_research_jobs;
create policy "service_role gestiona encargos"
  on ranking_research_jobs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
