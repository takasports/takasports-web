-- 089_album_and_saved_lineups
-- Álbum de cracks + onces guardados, server-backed (sincroniza web↔app).
-- Colección PERSONAL (no alimenta puntos/ranking) → escritura del propio
-- usuario vía RLS; sin service_role. Espejo de los módulos localStorage de la
-- web (src/lib/album.ts / src/lib/mionce-saved.ts), que pasan a "local primero
-- + sincronización en segundo plano" cuando hay sesión.
--
-- Aplicada vía MCP el 2026-06-22. get_advisors(security): 0 errores, 0 avisos
-- nuevos (las tablas llevan política self; las funciones son SECURITY INVOKER).

-- ── Álbum de cracks ──────────────────────────────────────────────────────
create table if not exists public.user_album (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  player_id  text        not null,
  first_seen date        not null default (now() at time zone 'Europe/Madrid')::date,
  count      integer     not null default 1 check (count >= 0),
  sources    text[]      not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, player_id)
);
alter table public.user_album enable row level security;
create policy user_album_self on public.user_album
  for all using ((select auth.uid()) = user_id);

-- Suma una aparición (atómico). INVOKER: corre como el usuario, RLS lo acota.
create or replace function public.album_collect(p_player_id text, p_source text)
returns void language sql security invoker
set search_path = public, pg_temp as $$
  insert into public.user_album (user_id, player_id, first_seen, count, sources)
  values ((select auth.uid()), p_player_id,
          (now() at time zone 'Europe/Madrid')::date, 1, array[p_source])
  on conflict (user_id, player_id) do update
    set count   = user_album.count + 1,
        sources = case when user_album.sources @> array[p_source]
                       then user_album.sources
                       else user_album.sources || p_source end,
        updated_at = now();
$$;

-- Fusión al iniciar sesión (sube el álbum local sin duplicar).
create or replace function public.album_merge(p_entries jsonb)
returns void language sql security invoker
set search_path = public, pg_temp as $$
  insert into public.user_album (user_id, player_id, first_seen, count, sources)
  select (select auth.uid()), e->>'playerId',
         coalesce((e->>'firstSeen')::date, (now() at time zone 'Europe/Madrid')::date),
         greatest(coalesce((e->>'count')::int, 1), 1),
         coalesce(array(select jsonb_array_elements_text(e->'sources')), '{}')
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e
  where e->>'playerId' is not null
  on conflict (user_id, player_id) do update
    set count      = greatest(user_album.count, excluded.count),
        sources    = (select array(select distinct unnest(user_album.sources || excluded.sources))),
        first_seen = least(user_album.first_seen, excluded.first_seen),
        updated_at = now();
$$;

revoke execute on function public.album_collect(text, text) from anon, public;
revoke execute on function public.album_merge(jsonb)       from anon, public;
grant  execute on function public.album_collect(text, text) to authenticated;
grant  execute on function public.album_merge(jsonb)       to authenticated;

-- ── Onces guardados ──────────────────────────────────────────────────────
create table if not exists public.user_mionce_lineups (
  id              uuid        not null default gen_random_uuid() primary key,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  name            text        not null,
  formation       text        not null,
  slots           jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  challenge_id    text,
  challenge_title text
);
create index if not exists user_mionce_lineups_user_created_idx
  on public.user_mionce_lineups (user_id, created_at desc);
alter table public.user_mionce_lineups enable row level security;
create policy user_mionce_lineups_self on public.user_mionce_lineups
  for all using ((select auth.uid()) = user_id);

-- Tope de 12 onces por usuario (la BD recorta los más antiguos al insertar).
create or replace function public.trim_mionce_lineups()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp as $$
begin
  delete from public.user_mionce_lineups
  where user_id = new.user_id and id in (
    select id from public.user_mionce_lineups
    where user_id = new.user_id order by created_at desc offset 12
  );
  return null;
end;
$$;
create trigger trim_mionce_lineups_after_insert
  after insert on public.user_mionce_lineups
  for each row execute function public.trim_mionce_lineups();
