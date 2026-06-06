-- 062_harden_record_game_play.sql  ·  Fase 4 · 4B (anti-trampa)
--
-- ⚠️ BORRADOR. Está en `supabase/migrations/drafts/` a propósito: `supabase db
-- push` NO aplica subcarpetas, así que esto NO llega a producción solo. Para
-- activarlo: revisar → mover a `supabase/migrations/062_...sql` → aplicar a mano
-- COORDINANDO con la sesión Ranked (toca un RPC de scoring compartido).
--
-- QUÉ ARREGLA (hallazgo 🔴 "ranking falsificable"): hoy `record_game_play` solo
-- valida `score 0..10_000`, así que un POST autenticado con score arbitrario
-- (la RPC es invocable directa por `authenticated`) entra al ranking. Esto pone
-- un TECHO POR JUEGO acorde al máximo real y valida el FORMATO de `period` según
-- la cadencia. El score se ACOTA (clamp) al techo en vez de rechazarse → un
-- cliente honesto nunca pierde su partida; un score inflado queda recortado. La
-- mejor puntuación sigue ganando (UPSERT con greatest).
--
-- Topes (máximos reales del juego): takagrid 9×20=180 · mionce 0–110 · sopacracks
-- 14×10=140 (+margen→150) · crackquiz ~165 (+margen→180). quiniela (scoring
-- propio de predicciones) y strikerrush (sin ventana) conservan el 10_000
-- defensivo — ajustar con la sesión Ranked si procede.
--
-- CREATE OR REPLACE conserva firma, `security definer`, owner y los GRANT de 039
-- (no había `search_path` fijado, así que no se altera nada más).
--
-- PENDIENTE (hardening futuro, fuera de este borrador):
--   · recomputar el score desde `p_payload` por juego (anti-trampa total), y
--   · validar que `period` sea el ACTUAL en hora de Madrid (now() AT TIME ZONE
--     'Europe/Madrid'), con margen para envíos justo tras medianoche.

create or replace function public.record_game_play(
  p_game_id     text,
  p_period      text,
  p_score       int,
  p_payload     jsonb default '{}'::jsonb,
  p_duration_ms int   default null
)
returns public.game_plays
language plpgsql security definer as $$
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

  -- Formato de `period` por cadencia (evita registrar bajo periodos basura o
  -- inventados). Daily="YYYY-MM-DD"; weekly="YYYY-Www" (+ "-TA" en Sopa contra-
  -- rreloj); quiniela usa jornada propia (alfanumérica acotada); strikerrush no
  -- tiene ventana y admite cualquier valor.
  if p_game_id in ('crackquiz','takagrid') then
    if p_period !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'bad daily period %', p_period;
    end if;
  elsif p_game_id in ('mionce','sopacracks') then
    if p_period !~ '^[0-9]{4}-W[0-9]{2}(-TA)?$' then
      raise exception 'bad weekly period %', p_period;
    end if;
  elsif p_game_id = 'quiniela' then
    if p_period !~ '^[A-Za-z0-9_-]{1,32}$' then
      raise exception 'bad jornada period %', p_period;
    end if;
  end if;

  -- Techo de score por juego: acota inflados sin penalizar al honesto.
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

revoke all on function public.record_game_play(text, text, int, jsonb, int) from public;
grant execute on function public.record_game_play(text, text, int, jsonb, int) to authenticated;
