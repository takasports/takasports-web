-- 120_creator_audience_view.sql
-- Desglose de audiencia por plataforma, con su procedencia.
--
-- ── POR QUÉ ──────────────────────────────────────────────────────
-- Dice cuántos seguidores aporta cada red Y si esa cifra está MEDIDA —tenemos
-- anclado el perfil, un script la relee cada semana— o es una estimación que
-- alguien escribió a mano y que nadie puede comprobar.
--
-- La distinción no es cosmética. Una cifra sembrada puede estar equivocada por
-- órdenes de magnitud sin que nada lo delate: Impacto MMA encabezó el ranking
-- entero con 22.800.000 suscriptores de YouTube cuando tiene 252.000, y ese
-- número llevaba meses ahí. Quedan 49 casillas así, 15,8 millones de seguidores
-- sumados, casi todas de Instagram, de gente cuyo perfil no hemos podido
-- anclar. Mientras existan, el ranking debe decir cuáles son.
--
-- ── POR QUÉ UNA VISTA Y NO UNA COLUMNA EN ranking_view ───────────
-- `creator_raw_metrics` tiene RLS sin políticas, así que ni la web con clave
-- pública ni la app pueden leerla. Una vista sin `security_invoker` corre como
-- su dueño y sí puede, y expone solo cifras que ya se pintan en la ficha
-- pública. Tocar `ranking_view` —matview, corazón del producto— por un detalle
-- de interfaz habría sido desproporcionado.
--
-- La consumen la ficha web (src/lib/creator-audience.ts) y la app.
create or replace view public.creator_audience_view as
select
  m.creator_id,
  e.category,
  x.red,
  x.seguidores,
  (e.handles ->> x.red) is not null as medida
from creator_raw_metrics m
join ranking_entries e on e.id = m.creator_id
cross join lateral (values
  ('youtube',   coalesce(m.yt_subscribers, 0)),
  ('instagram', coalesce(m.instagram_known, 0)),
  ('tiktok',    coalesce(m.tiktok_known, 0)),
  ('twitch',    coalesce(m.twitch_known, 0)),
  ('twitter',   coalesce(m.twitter_known, 0))
) as x(red, seguidores)
where x.seguidores > 0;

grant select on public.creator_audience_view to anon, authenticated;

comment on view public.creator_audience_view is
  'Seguidores por plataforma de cada creador y si la cifra está medida (perfil anclado) o es estimación. La consumen la ficha web y la app.';
