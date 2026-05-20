-- Push subscriptions para Web Push (VAPID).
-- Aditivo e idempotente: si la tabla ya existe (instalada manualmente en su
-- día para Quiniela), no toca nada. Solo asegura columnas y políticas.

create table if not exists push_subscriptions (
  endpoint     text primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  p256dh       text not null,
  auth         text not null,
  topics       text[] not null default array['quiniela']::text[],
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz
);

-- Índices útiles para /api/push/send (filtrado por topic) y por usuario
create index if not exists push_subscriptions_topics_idx on push_subscriptions using gin (topics);
create index if not exists push_subscriptions_user_idx   on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- INSERT/UPSERT/DELETE: cualquier cliente puede registrar su propio endpoint
-- (el endpoint es público pero único e inalterable; el riesgo es bajo).
-- SELECT: solo service role (lo lee adminSupabase() desde /api/push/send).

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'push_subs_insert') then
    create policy push_subs_insert on push_subscriptions for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'push_subs_update') then
    create policy push_subs_update on push_subscriptions for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'push_subs_delete') then
    create policy push_subs_delete on push_subscriptions for delete using (true);
  end if;
  -- No anon select por defecto: el service role bypasea RLS, así que no hace falta policy.
end $$;
