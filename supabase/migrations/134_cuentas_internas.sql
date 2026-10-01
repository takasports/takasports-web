-- 134 · Cuentas internas fuera de las clasificaciones públicas (01/10/2026)
--
-- El podio de la Liga Taka eran 3 cuentas de casa de 5: la de Taka Sports y
-- la que usa Apple para revisar la app, que además salía con la parte local
-- de su correo («contactotakasports+review»). Una clasificación así no es una
-- competición: es la prueba de que no hay nadie.
--
-- La marca vive en `profiles` y el filtro en las funciones que sirven las
-- clasificaciones, no en la API: así el puesto de cada uno (me-position lee la
-- misma función) cuadra con la lista que ve. Las cuentas siguen jugando y
-- puntuando con normalidad; solo dejan de aparecer.

alter table public.profiles
  add column if not exists oculto_en_clasificaciones boolean not null default false;

comment on column public.profiles.oculto_en_clasificaciones is
  'Cuenta interna (la de la casa, la de revisión de Apple): juega y puntúa, pero no sale en las clasificaciones públicas.';

-- Liga Taka (global y por deporte). Mismo cuerpo que antes + el filtro.
create or replace function public.get_ranked_leaderboard(p_sport text, p_limit integer default 50)
returns table(user_id uuid, display_name text, avatar_url text, total_points bigint, rank bigint)
language sql
stable security definer
set search_path to 'public'
as $function$
  SELECT
    pt.user_id,
    pr.display_name,
    pr.avatar_url,
    SUM(pt.amount)                          AS total_points,
    RANK() OVER (ORDER BY SUM(pt.amount) DESC) AS rank
  FROM point_transactions pt
  LEFT JOIN profiles pr ON pr.id = pt.user_id
  WHERE (p_sport IS NULL OR pt.sport = p_sport)
    AND NOT coalesce(pr.oculto_en_clasificaciones, false)
  GROUP BY pt.user_id, pr.display_name, pr.avatar_url
  ORDER BY total_points DESC
  LIMIT p_limit;
$function$;

-- Clasificación de una Jornada.
create or replace function public.get_jornada_leaderboard(p_week_key text, p_limit integer default 50)
returns table(user_id uuid, display_name text, avatar_url text, total_points bigint, hits bigint, played bigint, rank bigint)
language sql
stable security definer
set search_path to 'public'
as $function$
  WITH jornada AS (
    SELECT id
    FROM ranked_events
    WHERE sport = 'football'
      AND meta->>'week_key' = p_week_key
  ),
  picks AS (
    SELECT
      rp.user_id,
      count(*)                                  AS played,
      count(*) FILTER (WHERE rp.is_correct)     AS hits,
      coalesce(sum(rp.points_awarded), 0)       AS pts
    FROM ranked_predictions rp
    JOIN jornada j ON j.id = rp.event_id
    GROUP BY rp.user_id
  ),
  pleno AS (
    SELECT t.user_id, coalesce(sum(t.amount), 0) AS pts
    FROM point_transactions t
    WHERE t.source = 'ranked_pleno'
      AND t.context->>'week_key' = p_week_key
    GROUP BY t.user_id
  ),
  total AS (
    SELECT
      pk.user_id,
      pk.played,
      pk.hits,
      pk.pts + coalesce(pl.pts, 0) AS total_points
    FROM picks pk
    LEFT JOIN pleno pl ON pl.user_id = pk.user_id
  )
  SELECT
    t.user_id,
    p.display_name,
    p.avatar_url,
    t.total_points::bigint,
    t.hits::bigint,
    t.played::bigint,
    rank() OVER (ORDER BY t.total_points DESC, t.hits DESC, t.user_id)::bigint
  FROM total t
  LEFT JOIN profiles p ON p.id = t.user_id
  WHERE NOT coalesce(p.oculto_en_clasificaciones, false)
  ORDER BY t.total_points DESC, t.hits DESC, t.user_id
  LIMIT p_limit;
$function$;

-- Clasificaciones de los mini-juegos.
create or replace view public.v_game_leaderboard
with (security_invoker = on) as
 SELECT gp.game_id,
    gp.period,
    gp.user_id,
    gp.score,
    gp.duration_ms,
    gp.created_at,
    p.display_name,
    p.avatar_url,
    rank() OVER (PARTITION BY gp.game_id, gp.period ORDER BY gp.score DESC, gp.duration_ms, gp.created_at) AS "position"
   FROM game_plays gp
     LEFT JOIN profiles p ON p.id = gp.user_id
  WHERE NOT coalesce(p.oculto_en_clasificaciones, false);

-- Las dos cuentas de la casa: la de Taka Sports y la de revisión de Apple.
update public.profiles
   set oculto_en_clasificaciones = true
 where id in ('694310e6-3b42-4350-a61c-763783bc0319', 'f7954a21-6466-4837-a5bc-37ac64877997');
