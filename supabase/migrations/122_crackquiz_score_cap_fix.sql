-- 122_crackquiz_score_cap_fix.sql  ·  Paridad web↔app (Fase 1)
--
-- QUÉ ARREGLA: el techo de CrackQuiz (180) estaba por DEBAJO de su máximo real,
-- así que las mejores partidas se recortaban en silencio.
--
--   Máximo real de una ronda de 10 preguntas:
--     · 10 aciertos instantáneos → 10 × (10 base + 5 rapidez)          = 150
--     · bonus de racha 0+1+2+3+4+5+5+5+5+5                             =  35
--                                                                       ─────
--                                                                        185
--     · "doble o nada" aceptado y acertado duplica el combo bancado
--       (0+1+2+3+4+5+5+5+5 = 30)                                       = +30
--                                                                       ─────
--                                                                        215
--
-- Es decir: una ronda perfecta con la apuesta ganada perdía 35 puntos contra el
-- clamp. Subimos el techo a 220 (215 + margen), que sigue siendo un tope
-- antifraude estrecho. El resto de topes no cambia: takagrid 9×20=180,
-- mionce 11×10=110, sopacracks 14×10=140 (+margen 150).
--
-- La fórmula canónica vive en src/lib/game-scoring.ts (SCORE_CAP) y desde esta
-- fase el score se RECALCULA en el servidor (src/lib/game-score-server.ts)
-- antes de llamar a esta RPC — este clamp queda como última red de seguridad
-- para llamadas directas a la RPC (invocable por `authenticated`).
--
-- Recreación EXACTA de la 096 salvo la línea del techo de crackquiz. Preserva
-- `set search_path to 'public','pg_temp'`, security definer y grants
-- (CREATE OR REPLACE conserva privilegios: authenticated + service_role).

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

  -- Techo de score por juego (acota inflados; clamp). Máximos reales:
  -- takagrid 9x20=180 · mionce 11x10=110 · sopacracks 14x10=140(+margen 150)
  -- · crackquiz 215 (ronda perfecta + doble o nada ganado) (+margen 220).
  -- quiniela (scoring propio de predicciones) y strikerrush conservan el 10_000.
  v_cap := case p_game_id
    when 'takagrid'   then 180
    when 'mionce'     then 110
    when 'sopacracks' then 150
    when 'crackquiz'  then 220
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
