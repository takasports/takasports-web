-- Migración 040: mover add_coins y award_game_coins a service_role
-- Agrega p_user_id opcional para llamadas desde service_role.
-- Revoca de authenticated para que solo nuestros API routes (via adminSupabase)
-- puedan acreditar coins, eliminando la posibilidad de llamadas directas
-- al REST API de Supabase desde usuarios autenticados.

-- ── 1) add_coins: nueva versión con p_user_id opcional ───────────────────
-- Primero dropeamos la versión anterior (firma diferente si añadimos param)
drop function if exists public.add_coins(integer, text, jsonb);

create or replace function public.add_coins(
  p_amount   integer,
  p_reason   text,
  p_context  jsonb   default '{}',
  p_user_id  uuid    default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  -- service_role puede especificar p_user_id explícito (para acreditar a otro user).
  -- authenticated solo puede acreditar a sí mismo (p_user_id ignorado → usa auth.uid()).
  -- Nadie más puede llamar esta función (revocada de anon y public).
  if p_user_id is not null then
    if current_role != 'service_role' then
      raise exception 'p_user_id solo permitido para service_role';
    end if;
    uid := p_user_id;
  else
    uid := auth.uid();
  end if;

  if uid is null then raise exception 'auth required'; end if;
  if p_amount = 0 then return 0; end if;
  if abs(p_amount) > 5000 then raise exception 'amount out of range'; end if;

  insert into public.quiniela_coin_txns(user_id, amount, reason, context)
  values (uid, p_amount, p_reason, coalesce(p_context, '{}'));

  return p_amount;
end;
$$;

-- Solo service_role puede llamar add_coins
revoke all     on function public.add_coins(integer, text, jsonb, uuid) from public, anon, authenticated;
grant  execute on function public.add_coins(integer, text, jsonb, uuid) to service_role;

-- ── 2) award_game_coins: nueva versión con p_user_id opcional ────────────
drop function if exists public.award_game_coins(text, integer, text);

create or replace function public.award_game_coins(
  p_game_id  text,
  p_amount   integer,
  p_period   text,
  p_user_id  uuid    default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid          uuid;
  daily_cap    int  := 200;
  spent_24h    int;
  effective    int;
  already_has  boolean;
begin
  if p_user_id is not null then
    if current_role != 'service_role' then
      raise exception 'p_user_id solo permitido para service_role';
    end if;
    uid := p_user_id;
  else
    uid := auth.uid();
  end if;

  if uid is null then raise exception 'auth required'; end if;
  if p_amount is null or p_amount <= 0 then return 0; end if;
  if p_game_id is null or p_period is null then
    raise exception 'game_id and period required';
  end if;
  if p_game_id not in ('quiniela','crackquiz','mionce','sopacracks','takagrid','strikerrush') then
    raise exception 'unknown game_id %', p_game_id;
  end if;
  if p_amount > 500 then raise exception 'amount out of range'; end if;

  select exists(
    select 1 from public.quiniela_coin_txns
    where user_id = uid
      and (context->>'source')  = 'game'
      and (context->>'game_id') = p_game_id
      and (context->>'period')  = p_period
  ) into already_has;
  if already_has then return 0; end if;

  select coalesce(sum(amount), 0)::int into spent_24h
  from public.quiniela_coin_txns
  where user_id = uid
    and (context->>'source')  = 'game'
    and (context->>'game_id') = p_game_id
    and created_at >= now() - interval '24 hours';

  effective := least(p_amount, greatest(0, daily_cap - spent_24h));
  if effective <= 0 then return 0; end if;

  insert into public.quiniela_coin_txns(user_id, amount, reason, context)
  values (
    uid,
    effective,
    case
      when p_game_id = 'crackquiz'   then 'CrackQuiz · ' || p_period
      when p_game_id = 'mionce'      then 'Mi Once · ' || p_period
      when p_game_id = 'sopacracks'  then 'Sopa de Cracks · ' || p_period
      when p_game_id = 'takagrid'    then 'TakaGrid · ' || p_period
      when p_game_id = 'strikerrush' then 'Striker Rush · ' || p_period
      else p_game_id || ' · ' || p_period
    end,
    jsonb_build_object(
      'source',   'game',
      'game_id',  p_game_id,
      'period',   p_period,
      'amount_requested', p_amount,
      'amount_capped',    effective < p_amount
    )
  );

  return effective;
end;
$$;

-- Solo service_role puede llamar award_game_coins
revoke all     on function public.award_game_coins(text, integer, text, uuid) from public, anon, authenticated;
grant  execute on function public.award_game_coins(text, integer, text, uuid) to service_role;
