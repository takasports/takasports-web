-- 076 — Borrado de cuenta RGPD-completo (parte base de datos).
-- Antes, al borrar la cuenta, dos tablas usaban ON DELETE SET NULL y dejaban
-- datos personales residuales:
--   · push_subscriptions  -> quedaba endpoint + claves del dispositivo (permite
--                            seguir identificando/notificando ese navegador/móvil).
--   · quiniela_league_chat -> quedaba el apodo (nickname) + el texto del mensaje,
--                            atribuible a la persona aunque sin user_id.
-- Ahora ON DELETE CASCADE: al eliminar el usuario, esas filas desaparecen.
-- Ambas tablas están vacías hoy (pre-lanzamiento) -> cambio sin impacto.
-- match_reminders ya cascadea desde push_subscriptions(endpoint), así que sus
-- filas se limpian solas al borrarse la suscripción. Idempotente.

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_user_id_fkey;
alter table public.push_subscriptions
  add constraint push_subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.quiniela_league_chat
  drop constraint if exists quiniela_league_chat_user_id_fkey;
alter table public.quiniela_league_chat
  add constraint quiniela_league_chat_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
