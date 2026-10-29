-- 138 · Aviso de cada noche («los partidos de mañana», 29/10/2026).
--
-- La página de cada día del calendario suscribe navegadores al tema `agenda`
-- y /api/cron/agenda-noche les manda a las 22:00 de SU zona los partidos de su
-- «mañana». Para eso la suscripción necesita dos datos que no tenía:
--
--   timezone         → zona IANA del lector al suscribirse (la que usa la web
--                      para pintar horarios). Sin ella se usa Europe/Madrid.
--   agenda_sent_for  → último día del que se le avisó. Es la idempotencia del
--                      cron: corre cada hora y no puede avisar dos veces del
--                      mismo día.
--
-- Se escriben solo con service role desde el servidor (/api/push/subscribe y
-- el cron); la tabla ya no tiene políticas de escritura para el cliente
-- (migración 135).
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS agenda_sent_for date;
