-- Derechos de emisión por competición y país — la tabla que da de comer al bloque
-- "Dónde verlo" de las noticias de partido.
--
-- POR QUÉ UNA TABLA A MANO Y NO UNA API
-- No existe ninguna fuente gratuita y fiable de derechos de emisión: api-sports y
-- the-odds-api no los sirven, el campo `broadcasts` de ESPN cubre solo Estados
-- Unidos, y lo que hay en Wikipedia está sin estructurar y suele estar caducado.
-- Los proveedores que sí lo tienen bien son de pago. Como los derechos cambian una
-- vez por temporada y las competiciones que mueven tráfico son media docena, sale
-- más barato y más exacto mantenerlo aquí.
--
-- PARA QUÉ
-- Search Console, 90 días: Latinoamérica es el 62 % de las impresiones y solo el
-- 30 % de los clics, con la MISMA posición media que España (9-10 en ambos casos;
-- Perú incluso mejor, 9,3, con un CTR del 0,28 % frente al 1,44 % de España). No
-- posicionamos peor allí: el resultado no le parece suyo al lector, porque el
-- titular y el snippet hablan en hora peninsular y de canales españoles.
--
-- La página renderiza la tabla ENTERA, con todos los países, y es el navegador
-- quien sube arriba la fila del lector. Nunca se sirve HTML distinto según el país:
-- Googlebot rastrea casi siempre desde Estados Unidos, así que geo-variar el HTML
-- haría que Google indexara la variante estadounidense y el resto no existiría para
-- el buscador. Con todos los países dentro, en cambio, entramos en las búsquedas de
-- cola larga de cada uno ("dónde ver el clásico en chile").
--
-- VERIFICADO
-- `verified` arranca en false y NADA se muestra hasta que un humano lo pone a true.
-- Un canal equivocado es peor que no poner canal: la carga inicial de
-- scripts/seed-broadcast-rights.mjs es una propuesta, no un dato confirmado.
--
-- Aditivo y reversible: drop table public.broadcast_rights.

create table if not exists public.broadcast_rights (
  id                bigint generated always as identity primary key,
  -- Clave interna estable ('laliga', 'premier', 'champions', 'ufc', 'selecciones').
  -- El nombre que trae la noticia es texto libre del pipeline, así que se normaliza
  -- en src/lib/broadcast.ts antes de consultar.
  competition_key   text        not null,
  -- ISO 3166-1 alfa-2 en mayúsculas ('ES', 'MX', 'AR'…).
  country_code      text        not null,
  -- Uno o varios operadores. Se pintan separados por " / " en el orden dado.
  channels          text[]      not null,
  -- Enlace opcional a la guía o al operador principal.
  url               text,
  -- Matiz editorial ("solo partidos seleccionados", "requiere suscripción").
  note              text,
  verified          boolean     not null default false,
  -- Ventana de vigencia. Ambas nulas = vigente hasta nuevo aviso.
  valid_from        date,
  valid_to          date,
  updated_at        timestamptz not null default now(),
  constraint broadcast_rights_country_alpha2 check (country_code ~ '^[A-Z]{2}$'),
  constraint broadcast_rights_channels_not_empty check (array_length(channels, 1) >= 1),
  constraint broadcast_rights_unique unique (competition_key, country_code)
);

comment on table public.broadcast_rights is
  'Dónde se emite cada competición en cada país. Curada a mano; verified=false no se muestra.';

-- La consulta caliente es siempre "todas las filas vigentes de esta competición".
create index if not exists broadcast_rights_lookup_idx
  on public.broadcast_rights (competition_key)
  where verified;

-- Solo service_role. La web lee desde Server Components y desde /api/broadcast con
-- la service key; el navegador nunca habla directamente con esta tabla.
alter table public.broadcast_rights enable row level security;
revoke all on public.broadcast_rights from anon, authenticated;
grant all on public.broadcast_rights to service_role;
