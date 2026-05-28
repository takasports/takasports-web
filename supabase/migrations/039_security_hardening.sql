-- Endurecimiento de seguridad detectado por Supabase advisors (mayo 2026).
--
-- Esta migración aplica los fixes que NO rompen la app actual. Quedan por
-- hacer (deuda técnica documentada en SECURITY.md):
--
--   · add_coins / award_game_coins siguen siendo ejecutables por
--     `authenticated`. Hoy el cliente quiniela y `/api/games/plays` los
--     llaman con cookies de sesión usando `auth.uid()` interno. Un usuario
--     logueado puede invocarlas con cualquier payload y darse hasta 5000
--     coins por petición (cap interno) — riesgo real para el ranking.
--     Migración futura: mover toda la lógica a la API server (service_role)
--     y revocar EXECUTE de `authenticated`.
--
-- Esta migración SÍ aplica:
--   1) push_subscriptions: cierra `WITH CHECK (true)` que permitía a
--      cualquiera insertar suscripciones falsas.
--   2) increment_comment_flag: la API ya usa service_role, no hace falta
--      que anon/authenticated la ejecuten directamente. Si lo hicieran
--      podrían inflar flags y silenciar comentarios.
--   3) record_game_play, ping_game_streak, quiniela_consensus: revoca de
--      `anon` (siguen para `authenticated` que es lo legítimo). Antes anon
--      podía registrar plays falsos sin login.
--   4) Fix `function_search_path_mutable` en 4 funciones (vector de
--      hijacking de schema vía search_path).

-- ── 1) push_subscriptions: policy INSERT restrictiva ─────────────────────
drop policy if exists push_subs_insert on public.push_subscriptions;

create policy push_subs_insert on public.push_subscriptions
  for insert
  to anon, authenticated
  with check (
    -- Suscripción anónima (sin login) → user_id NULL permitido.
    -- Suscripción con sesión → user_id debe coincidir con auth.uid().
    user_id is null or user_id = auth.uid()
  );

-- ── 2) increment_comment_flag: solo service_role ─────────────────────────
revoke execute on function public.increment_comment_flag(uuid)
  from public, anon, authenticated;
grant  execute on function public.increment_comment_flag(uuid)
  to service_role;

-- ── 3) RPCs de juegos: quitar `anon` ─────────────────────────────────────
revoke execute on function public.record_game_play(text, text, integer, jsonb, integer)
  from public, anon;
grant  execute on function public.record_game_play(text, text, integer, jsonb, integer)
  to authenticated;

revoke execute on function public.ping_game_streak()
  from public, anon;
grant  execute on function public.ping_game_streak()
  to authenticated;

revoke execute on function public.quiniela_consensus(text)
  from public, anon;
grant  execute on function public.quiniela_consensus(text)
  to authenticated;

-- search_players queda accesible a anon a propósito (autocompletado SEO,
-- sin escritura).

-- ── 4) Fix search_path mutable en funciones flagged ──────────────────────
alter function public.add_coins(integer, text, jsonb)
  set search_path = '';
alter function public.award_game_coins(text, integer, text)
  set search_path = '';
alter function public.f_route_jobs_touch_updated_at()
  set search_path = '';
alter function public.f_entity_images_touch_updated_at()
  set search_path = '';
