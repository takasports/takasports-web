-- 036_article_comments.sql
-- Comentarios en artículos. MVP seguro por defecto:
--  - Solo usuarios logueados (auth.uid()) pueden insertar
--  - Texto plano hasta 1000 chars (sanitización + linkify en cliente)
--  - Sin moderación previa pero con sistema de reportes
--  - RLS estricta: cualquiera lee no-borrados, solo author borra own

create table if not exists article_comments (
  id              uuid primary key default gen_random_uuid(),
  article_slug    text not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  user_name       text not null,        -- denormalizado para no joins en cada lectura
  user_avatar     text,                  -- URL del avatar (opcional)
  body            text not null check (char_length(body) between 1 and 1000),
  flagged_count   int  not null default 0,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists article_comments_slug_idx
  on article_comments (article_slug, created_at desc)
  where deleted_at is null;

create index if not exists article_comments_user_idx
  on article_comments (user_id, created_at desc);

alter table article_comments enable row level security;

-- Lectura pública de comentarios no borrados
drop policy if exists "select_public" on article_comments;
create policy "select_public" on article_comments
  for select using (deleted_at is null);

-- Insertar solo si el user_id coincide con la sesión actual
drop policy if exists "insert_own" on article_comments;
create policy "insert_own" on article_comments
  for insert with check (auth.uid() = user_id);

-- Borrar solo own (soft delete vía deleted_at lo hace el endpoint con
-- service_role; el delete físico también solo de own)
drop policy if exists "delete_own" on article_comments;
create policy "delete_own" on article_comments
  for delete using (auth.uid() = user_id);

comment on table article_comments is
  'Comentarios públicos en artículos. RLS: lectura abierta, escritura solo logueados, borrado solo own.';

-- ── Reportes / flags ──────────────────────────────────────────────
-- Una fila por (comment_id, reporter_id) — un usuario solo reporta una vez
-- el mismo comentario. El endpoint incrementa flagged_count en el comentario
-- cuando se inserta un report nuevo.

create table if not exists article_comment_reports (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references article_comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason      text check (char_length(reason) <= 200),
  created_at  timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create index if not exists article_comment_reports_comment_idx
  on article_comment_reports (comment_id, created_at desc);

alter table article_comment_reports enable row level security;

drop policy if exists "insert_own_report" on article_comment_reports;
create policy "insert_own_report" on article_comment_reports
  for insert with check (auth.uid() = reporter_id);

-- Solo admin lee reportes (vía service_role, sin policy de SELECT)

comment on table article_comment_reports is
  'Reportes de comentarios. Constraint unique evita spam: un usuario reporta el mismo comentario solo una vez. Sin policy SELECT — solo admin con service_role lee.';
