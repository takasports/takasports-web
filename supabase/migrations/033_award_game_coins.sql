-- ─────────────────────────────────────────────────────────────────
-- 033 — RPC award_game_coins: monedas cross-game para Ranked
--
-- Hasta ahora, las monedas solo se acreditaban en quiniela
-- (api/quiniela/score → add_coins). Los juegos diarios (CrackQuiz,
-- MiOnce, SopaCracks, TakaGrid, StrikerRush) registraban game_plays
-- pero NO daban monedas, lo que rompía la promesa central del modelo:
-- «los juegos diarios dan monedas para el Ranked».
--
-- Esta RPC es el wrapper anti-cheat para acreditar monedas desde
-- cualquier juego. Mantiene la misma garantía que add_coins
-- (security definer + audit en quiniela_coin_txns) y añade:
--   · Idempotencia por (user, game_id, period): si ya se acreditó
--     monedas para ese (juego, periodo), no vuelve a acreditar.
--     Hermana de la idempotencia que game_plays tiene a nivel score.
--   · Cap diario absoluto por (user, game_id) en las últimas 24h:
--     trunca el amount si exceder el cap; nunca rechaza el award
--     completo. Defensa contra payload manipulado client-side.
--
-- IMPORTANTE — qué NO toca esta migración:
--   · No modifica add_coins, record_game_play, ping_game_streak.
--   · No modifica quiniela_coin_txns (reusa la tabla como wallet único
--     hasta que el rename a taka_coin_txns se haga aparte).
--   · No modifica game_plays ni juegos existentes.
--
-- Aplicar en: Supabase Dashboard → SQL Editor.
-- Idempotente: usa "or replace" para la función.
-- ─────────────────────────────────────────────────────────────────

-- Cap diario por juego. Conservador para evitar grinding y dejar
-- el grueso de monedas para quiniela. Ajustable después.
-- 5 juegos × 200 = 1000 monedas/día máximo cross-game.
-- Quiniela ranked sigue acreditando aparte (sin este cap).
-- Si querés ajustar por juego, sustituir por tabla game_coin_caps.

create or replace function public.award_game_coins(
  p_game_id text,
  p_amount  int,
  p_period  text
)
returns int                              -- monedas efectivamente acreditadas (0 si nada)
language plpgsql security definer as $$
declare
  uid          uuid := auth.uid();
  daily_cap    int  := 200;              -- por (user, game_id) en 24h
  spent_24h    int;
  effective    int;
  already_has  boolean;
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_amount is null or p_amount <= 0 then return 0; end if;
  if p_game_id is null or p_period is null then
    raise exception 'game_id and period required';
  end if;
  if p_game_id not in ('quiniela','crackquiz','mionce','sopacracks','takagrid','strikerrush') then
    raise exception 'unknown game_id %', p_game_id;
  end if;
  -- Defensa adicional contra payload abusivo. Misma escala que add_coins.
  if p_amount > 500 then raise exception 'amount out of range'; end if;

  -- Idempotencia: si ya se acreditó para este (user, game, period) desde
  -- el source 'game', no volvemos a sumar. Sin esto, varias llamadas
  -- consecutivas (retry de red, doble click, etc.) inflarían el balance.
  select exists(
    select 1 from public.quiniela_coin_txns
    where user_id = uid
      and (context->>'source')  = 'game'
      and (context->>'game_id') = p_game_id
      and (context->>'period')  = p_period
  ) into already_has;
  if already_has then return 0; end if;

  -- Cap diario rolling 24h por (user, game). Sumamos lo gastado en este
  -- juego en las últimas 24h y truncamos al límite si fuera necesario.
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

revoke all     on function public.award_game_coins(text, int, text) from public;
grant  execute on function public.award_game_coins(text, int, text) to authenticated;

-- Índice para acelerar las queries de idempotencia y cap rolling.
-- Filtramos por context jsonb que ya es indexable directamente; un
-- índice expression evita el scan completo cuando el ledger crece.
create index if not exists qct_game_period_idx
  on public.quiniela_coin_txns ((context->>'source'), (context->>'game_id'), (context->>'period'))
  where (context->>'source') = 'game';

create index if not exists qct_game_24h_idx
  on public.quiniela_coin_txns (user_id, (context->>'game_id'), created_at desc)
  where (context->>'source') = 'game';

-- ─────────────────────────────────────────────────────────────────
-- Verificación tras aplicar:
--   select * from pg_proc where proname = 'award_game_coins';
--   -- Probar manualmente con tu uid (en SQL Editor con auth.uid()
--   -- de la sesión actual del editor → siempre nulo, así que el test
--   -- real va vía /api/games/plays con sesión auth):
--   -- select public.award_game_coins('crackquiz', 15, '2026-05-22');
-- ─────────────────────────────────────────────────────────────────
