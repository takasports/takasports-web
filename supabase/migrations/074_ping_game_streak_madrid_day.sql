-- 074_ping_game_streak_madrid_day.sql
-- La racha de juegos (game_streaks) contaba el "día" con current_date, que en
-- el servidor Supabase es UTC. El resto del ecosistema usa Europe/Madrid
-- (src/lib/taka-time.ts) → cerca de la medianoche de Madrid la racha podía
-- contar mal un día (el banner "racha en riesgo" y last_played_date quedaban
-- desalineados con el día Madrid que usa el cliente).
--
-- Fix: `today` = día de Madrid, calculado EN EL SERVIDOR:
--   (now() AT TIME ZONE 'Europe/Madrid')::date
-- No se confía ninguna fecha del cliente → no abre vía de trampa para inflar
-- la racha. Compatible hacia atrás, sin migración de datos, autocorrectivo.
--
-- Copia FIEL de la def viva (pg_get_functiondef) — SOLO cambia la línea `today`.
-- CREATE OR REPLACE conserva el ACL (grant EXECUTE a authenticated, intencional)
-- y se preserva SECURITY DEFINER + SET search_path = 'public','pg_temp'.

CREATE OR REPLACE FUNCTION public.ping_game_streak()
 RETURNS game_streaks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  uid    uuid := auth.uid();
  today  date := (now() AT TIME ZONE 'Europe/Madrid')::date;   -- antes: current_date (UTC)
  row    public.game_streaks;
  prev   public.game_streaks;
  new_streak int;
begin
  if uid is null then raise exception 'auth required'; end if;

  select * into prev from public.game_streaks where user_id = uid;

  if prev.user_id is null then
    insert into public.game_streaks (user_id, current_streak, best_streak, last_played_date, total_plays)
    values (uid, 1, 1, today, 1)
    returning * into row;
    return row;
  end if;

  if prev.last_played_date = today then
    new_streak := prev.current_streak;
  elsif prev.last_played_date = today - 1 then
    new_streak := prev.current_streak + 1;
  else
    new_streak := 1;
  end if;

  update public.game_streaks
    set current_streak   = new_streak,
        best_streak      = greatest(prev.best_streak, new_streak),
        last_played_date = today,
        total_plays      = prev.total_plays + 1,
        updated_at       = now()
    where user_id = uid
  returning * into row;

  return row;
end;
$function$;
