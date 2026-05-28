-- Tabla genérica para rate-limit por IP / clave compartida con TTL implícito.
-- Usada por el helper TS `src/lib/rate-limit.ts` para newsletter, comments,
-- push subscribe, reels ingest, etc.
--
-- Modelo "fixed window": (bucket, key, window_start) es PK. La función
-- `rate_limit_hit` hace upsert + incremento atómico en una sola llamada y
-- devuelve el contador resultante. Limpieza: trigger AFTER INSERT que purga
-- filas con window_start anterior a `now() - interval '2 hours'`. No es
-- crítico porque la PK incluye window_start (no hay colisión histórica).

create table if not exists public.rate_limits (
  bucket        text        not null,
  key           text        not null,
  window_start  timestamptz not null,
  count         integer     not null default 0,
  primary key (bucket, key, window_start)
);

-- Solo el service role escribe/lee. RLS habilitado deny-by-default.
alter table public.rate_limits enable row level security;
-- (no policies → anon/authenticated quedan denegados; service_role bypassea RLS)

-- Función atómica de incremento. Devuelve el nuevo count.
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_key text,
  p_window_start timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as rl (bucket, key, window_start, count)
  values (p_bucket, p_key, p_window_start, 1)
  on conflict (bucket, key, window_start)
  do update set count = rl.count + 1
  returning count into v_count;

  return v_count;
end;
$$;

-- Solo el service role puede llamarla. anon/authenticated NO la pueden ejecutar
-- (si la pudieran ejecutar, un atacante podría inflar contadores de otras IPs).
revoke all on function public.rate_limit_hit(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, timestamptz) to service_role;

-- Limpieza periódica de filas viejas (>2h) — barato porque es función simple.
-- Pensado para llamarse desde un cron diario o desde la propia rate_limit_hit
-- con muestreo. De momento, dejarla a disposición para que un job la dispare.
create or replace function public.rate_limit_purge_old()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits
  where window_start < now() - interval '2 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.rate_limit_purge_old() from public, anon, authenticated;
grant execute on function public.rate_limit_purge_old() to service_role;
