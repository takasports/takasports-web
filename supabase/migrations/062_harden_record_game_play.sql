-- 062_harden_record_game_play.sql  ·  Fase 4 · 4B (anti-trampa)
--
-- ✅ APLICADA a producción el 2026-06-06 (vía MCP, migración
-- `harden_record_game_play_score_caps`). Verificada: caps por juego + clamp
-- presentes, `search_path` preservado, grants intactos (authenticated +
-- service_role, sin anon/public).
--
-- QUÉ ARREGLA (hallazgo 🔴 "ranking falsificable"): antes el RPC solo validaba
-- `score 0..10_000`, así que un POST autenticado con score arbitrario (la RPC es
-- invocable directa por `authenticated`) entraba al ranking. Ahora hay un TECHO
-- POR JUEGO acorde al máximo real; el score se ACOTA (clamp con least) en vez de
-- rechazarse → un cliente honesto nunca pierde su partida, un inflado queda
-- recortado. La mejor puntuación sigue ganando (UPSERT con greatest).
--
-- Topes (máximos reales): takagrid 9×20=180 · mionce 0–110 · sopacracks
-- 14×10=140 (+margen→150) · crackquiz ~165 (+margen→180). quiniela (scoring
-- propio de predicciones) y strikerrush (sin ventana) conservan el 10_000.
--
-- ⚠️ IMPORTANTE: preserva `set search_path to 'public', 'pg_temp'` (hardening de
-- una migración previa). Un CREATE OR REPLACE sin esta cláusula lo borraría.
--
-- DIFERIDO (NO incluido aquí): validar el FORMATO de `period`. Riesgo de rechazar
-- recording legítimo: Quiniela usa `jornada` de formato incierto (puede traer
-- espacios, p.ej. "Sin jornada activa") y el admin permite period arbitrario.
-- Antes de añadirlo hay que auditar todos los formatos reales y coordinar con
-- Ranked (dueño de Quiniela). Hardening futuro extra: recomputar el score desde
-- `p_payload` por juego, y validar que `period` sea el ACTUAL en hora de Madrid.

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

  -- Techo de score por juego (acota inflados; clamp, no rechazo).
  v_cap := case p_game_id
    when 'takagrid'   then 180
    when 'mionce'     then 110
    when 'sopacracks' then 150
    when 'crackquiz'  then 180
    else 10000  -- quiniela / strikerrush: defensivo
  end;
  v_score := least(p_score, v_cap);

  insert into public.game_plays (user_id, game_id, period, score, payload, duration_ms)
  values (uid, p_game_id, p_period, v_score, coalesce(p_payload, '{}'::jsonb), p_duration_ms)
  on conflict (user_id, game_id, period) do update
    set score       = greatest(public.game_plays.score, excluded.score),
        payload     = excluded.payload,
        duration_ms = coalesce(excluded.duration_ms, public.game_plays.duration_ms),
        updated_at  = now()
  returning * into row;

  return row;
end;
$$;
