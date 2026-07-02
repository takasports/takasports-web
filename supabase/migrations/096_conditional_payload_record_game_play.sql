-- 096_conditional_payload_record_game_play.sql  ·  F2 (integridad servidor)
--
-- QUÉ ARREGLA: en el UPSERT de record_game_play, el `score` se conservaba con
-- greatest() (la mejor puntuación gana) PERO el `payload` se sobrescribía SIEMPRE
-- con excluded.payload. Consecuencia: si un usuario repite una partida y saca
-- PEOR resultado, su score se mantenía (bien) pero el payload de la partida
-- BUENA se perdía (mal) — corrompe historial, heatmap de crackquiz (answers) y
-- cualquier dato derivado del payload.
--
-- FIX: condicionar el payload a que el nuevo score MEJORE. Con score igual o
-- peor, se conserva el payload de la mejor partida — coherente con "la mejor
-- puntuación (y sus datos) gana".
--
-- Recreación EXACTA de la 062 salvo la línea del payload. Preserva
-- `set search_path to 'public','pg_temp'`, security definer, topes por juego y
-- grants (CREATE OR REPLACE conserva los privilegios existentes:
-- authenticated + service_role, sin anon/public).

create or replace function public.record_game_play(
  p_game_id     text,
  p_period      text,
  p_score       int,
  p_payload     jsonb default '{}'::jsonb,
  p_duration_ms int   default null
)
returns public.game_plays
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  uid uuid := auth.uid();
  row public.game_plays;
  v_cap   int;
  v_score int;
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_game_id is null or p_period is null then
    raise exception 'game_id and period required';
  end if;
  if p_game_id not in ('quiniela','crackquiz','mionce','sopacracks','takagrid','strikerrush') then
    raise exception 'unknown game_id %', p_game_id;
  end if;
  if p_score < 0 then
    raise exception 'score out of range';
  end if;

  -- Techo de score por juego (acota inflados; clamp). Maximos reales:
  -- takagrid 9x20=180 · mionce 0-110 · sopacracks 14x10=140(+margen) · crackquiz ~165(+margen).
  -- quiniela (scoring propio de predicciones) y strikerrush conservan el 10_000 defensivo.
  v_cap := case p_game_id
    when 'takagrid'   then 180
    when 'mionce'     then 110
    when 'sopacracks' then 150
    when 'crackquiz'  then 180
    else 10000
  end;
  v_score := least(p_score, v_cap);

  insert into public.game_plays (user_id, game_id, period, score, payload, duration_ms)
  values (uid, p_game_id, p_period, v_score, coalesce(p_payload, '{}'::jsonb), p_duration_ms)
  on conflict (user_id, game_id, period) do update
    set score       = greatest(public.game_plays.score, excluded.score),
        -- El payload SOLO se actualiza si el nuevo score mejora al guardado;
        -- así una repetición con peor marca no pisa los datos de la buena.
        payload     = case
                        when excluded.score > public.game_plays.score
                        then excluded.payload
                        else public.game_plays.payload
                      end,
        duration_ms = coalesce(excluded.duration_ms, public.game_plays.duration_ms),
        updated_at  = now()
  returning * into row;

  return row;
end;
$$;
