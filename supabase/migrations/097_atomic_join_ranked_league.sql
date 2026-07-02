-- 097_atomic_join_ranked_league.sql  ·  F2 (integridad servidor)
--
-- QUÉ ARREGLA (carrera TOCTOU de aforo): /api/ranked/leagues/[id]/join leía el
-- número de miembros y DESPUÉS insertaba, en dos llamadas separadas. Con dos
-- peticiones simultáneas cerca del tope, ambas leían el mismo count, ambas
-- pasaban la comprobación y ambas insertaban → la liga superaba max_members.
--
-- FIX: función que hace "bloquear liga + comprobar aforo + insertar" en UNA
-- transacción. El `SELECT ... FOR UPDATE` sobre la fila de la liga SERIALIZA las
-- altas concurrentes a esa misma liga: la 2ª petición espera a que la 1ª cierre
-- y entonces recuenta (ya con el nuevo miembro) → nunca se pasa del tope.
--
-- SEGURIDAD: SECURITY DEFINER (inserta saltándose RLS, igual que hacía el
-- service_role de la ruta). La validación del invite_code de las ligas privadas
-- sigue en la RUTA, ANTES de llamar aquí; por eso esta función NO debe ser
-- invocable por anon/authenticated (si no, un usuario se colaría sin código).
-- EXECUTE solo para service_role. search_path endurecido.
--
-- La PK (league_id, user_id) ya impide duplicar el mismo usuario; el
-- unique_violation se captura como 'already_member' (doble clic del mismo user).

create or replace function public.join_ranked_league(
  p_league_id text,
  p_user_id   uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_max   int;
  v_count int;
begin
  if p_league_id is null or p_user_id is null then
    raise exception 'league_id and user_id required';
  end if;

  -- Bloquea la fila de la liga → serializa las altas concurrentes a ESTA liga.
  select max_members into v_max
  from public.ranked_leagues
  where id = p_league_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if exists (
    select 1 from public.ranked_league_members
    where league_id = p_league_id and user_id = p_user_id
  ) then
    return jsonb_build_object('status', 'already_member');
  end if;

  select count(*) into v_count
  from public.ranked_league_members
  where league_id = p_league_id;

  if v_count >= v_max then
    return jsonb_build_object('status', 'full', 'max_members', v_max);
  end if;

  insert into public.ranked_league_members (league_id, user_id)
  values (p_league_id, p_user_id);

  return jsonb_build_object('status', 'joined');
exception
  when unique_violation then
    -- Doble clic del mismo usuario: la PK ya lo protege.
    return jsonb_build_object('status', 'already_member');
end;
$$;

-- Bloqueada a service_role (la ruta la invoca con el cliente admin). Nunca
-- expuesta a anon/authenticated: saltaría la validación del invite_code.
revoke all on function public.join_ranked_league(text, uuid) from public;
revoke all on function public.join_ranked_league(text, uuid) from anon;
revoke all on function public.join_ranked_league(text, uuid) from authenticated;
grant execute on function public.join_ranked_league(text, uuid) to service_role;
