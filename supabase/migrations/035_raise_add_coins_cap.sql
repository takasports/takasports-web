-- ─────────────────────────────────────────────────────────────────
-- 035 — Subir cap absoluto de add_coins de 500 a 5000.
--
-- Contexto: el rediseño del scoring Ranked pasa de «base 10 × cuota»
-- (potencialmente 10×100 = 1000 en cuotas extremas, pero típicamente
-- <500) a «stake variable × cuota». Con STAKE_MAX=200 y cuotas hasta
-- ~5 (estimación generosa), un pick acertado puede pagar 1000 monedas.
-- En cuotas muy altas (jugadores arriesgando ×10) puede pasar de 2000.
--
-- El cap previo de 500 por txn ahogaba esto y forzaba split-acreditaciones
-- (feo). Subido a 5000 cubre incluso stake máximo × cuota 25 (1 entre
-- mil). Mantiene la defensa contra abuso por bug de cliente.
--
-- IMPORTANTE — qué NO toca esta migración:
--   · No modifica award_game_coins (los juegos diarios tienen su
--     propio cap interno de 200/día y el cap por txn de 500 sigue
--     siendo apropiado para ese caso).
--   · No modifica record_game_play, ni quiniela_coin_txns, ni la vista
--     quiniela_coin_balance.
--
-- Aplicar en: Supabase Dashboard → SQL Editor.
-- Idempotente: "create or replace" sobre la función existente.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.add_coins(
  p_amount  int,
  p_reason  text,
  p_context jsonb default '{}'::jsonb
)
returns int
language plpgsql security definer as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_amount = 0 then return 0; end if;
  -- Cap absoluto por transacción para evitar abusos por bug de cliente.
  -- Subido de 500 → 5000 para acomodar Ranked con stake variable.
  if abs(p_amount) > 5000 then raise exception 'amount out of range'; end if;
  insert into public.quiniela_coin_txns(user_id, amount, reason, context)
  values (uid, p_amount, p_reason, coalesce(p_context, '{}'::jsonb));
  return p_amount;
end;
$$;

revoke all     on function public.add_coins(int, text, jsonb) from public;
grant  execute on function public.add_coins(int, text, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Verificación tras aplicar:
--   select prosrc from pg_proc where proname='add_coins';
--   -- Debe contener "abs(p_amount) > 5000".
-- ─────────────────────────────────────────────────────────────────
