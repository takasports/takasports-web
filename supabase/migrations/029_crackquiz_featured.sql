-- Pregunta destacada (de actualidad) del día para CrackQuiz.
-- Una fila por día. El endpoint admin /api/crackquiz/featured (POST/DELETE)
-- la gestiona contra GAMES_ADMIN_TOKEN; el cliente lee anónimo.

create table if not exists crackquiz_featured (
  day_iso     date primary key,
  question    jsonb not null,
  created_at  timestamptz not null default now()
);

alter table crackquiz_featured enable row level security;

-- Lectura abierta — la pregunta destacada no es secreta. INSERT/UPDATE/DELETE
-- pasan por el endpoint admin, que usa service role.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='crackquiz_featured' and policyname='crackquiz_featured_read_anon') then
    create policy crackquiz_featured_read_anon on crackquiz_featured for select using (true);
  end if;
end $$;
