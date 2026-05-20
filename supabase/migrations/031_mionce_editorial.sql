-- Once editorial canónico publicado por la redacción por semana ISO.
-- Tras cerrar el reto, el usuario puede comparar sus picks contra el editorial.
-- Una fila por semana. Lectura anónima, escritura por GAMES_ADMIN_TOKEN.

create table if not exists mionce_editorial (
  week_iso   text primary key,            -- YYYY-Www
  title      text not null,
  formation  text not null,               -- 4-3-3, 4-4-2, 3-5-2, 4-2-3-1
  slots      jsonb not null,              -- { slotId: playerId }
  note       text,                        -- comentario corto opcional
  created_at timestamptz not null default now()
);

alter table mionce_editorial enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mionce_editorial' and policyname='mionce_editorial_read_anon') then
    create policy mionce_editorial_read_anon on mionce_editorial for select using (true);
  end if;
end $$;
