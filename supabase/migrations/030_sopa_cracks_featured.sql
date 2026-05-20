-- Puzzle destacado de Sopa de Cracks por semana ISO.
-- Una fila por semana. El endpoint admin (/api/sopa-cracks/featured) la
-- gestiona contra GAMES_ADMIN_TOKEN; el cliente lee anónimo.

create table if not exists sopa_cracks_featured (
  week_iso    text primary key,    -- YYYY-Www
  title       text not null,
  subtitle    text not null,
  size        integer not null default 13,
  words       text[] not null,
  intruder    text,
  created_at  timestamptz not null default now()
);

alter table sopa_cracks_featured enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sopa_cracks_featured' and policyname='sopa_cracks_featured_read_anon') then
    create policy sopa_cracks_featured_read_anon on sopa_cracks_featured for select using (true);
  end if;
end $$;
