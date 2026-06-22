-- 087 · Blindar el chat de ligas privadas (quiniela_league_chat)
--
-- ANTES (agujero):
--   · chat_read  SELECT USING (true)      → cualquier anónimo podía LEER el chat
--                                            de cualquier liga vía PostgREST con
--                                            la anon key (fuga de mensajes,
--                                            nicknames y user_id de terceros).
--   · chat_insert WITH CHECK (auth.uid()=user_id OR user_id IS NULL)
--                                          → cualquiera podía INSERTAR mensajes
--                                            (user_id NULL) en cualquier liga.
--   · sin policy DELETE                    → el borrado SIEMPRE fallaba pese a que
--                                            el código afirmaba "RLS lo controla".
--
-- AHORA: leer/escribir exige pertenencia a la liga (miembro u owner); borrar =
-- autor del mensaje u owner de la liga. La capa API ya lee con el token del
-- usuario (cookie web O Bearer app), así que un miembro legítimo sigue viendo su
-- chat; un no-miembro/anónimo recibe lista vacía.
--
-- Nota: las subconsultas a quiniela_league_members / quiniela_leagues funcionan
-- porque ambas tienen lectura pública (lm_read / leagues_read USING(true)).

-- ── Lectura: solo miembros u owner de la liga ──────────────────────────────
DROP POLICY IF EXISTS chat_read ON public.quiniela_league_chat;
CREATE POLICY chat_read ON public.quiniela_league_chat
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiniela_league_members m
      WHERE m.league_id = quiniela_league_chat.league_id
        AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.quiniela_leagues l
      WHERE l.id = quiniela_league_chat.league_id
        AND l.owner_id = (SELECT auth.uid())
    )
  );

-- ── Inserción: el propio autor (auth.uid()=user_id) y debe ser miembro/owner ─
DROP POLICY IF EXISTS chat_insert ON public.quiniela_league_chat;
CREATE POLICY chat_insert ON public.quiniela_league_chat
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.quiniela_league_members m
        WHERE m.league_id = quiniela_league_chat.league_id
          AND m.user_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.quiniela_leagues l
        WHERE l.id = quiniela_league_chat.league_id
          AND l.owner_id = (SELECT auth.uid())
      )
    )
  );

-- ── Borrado: autor del mensaje u owner de la liga ──────────────────────────
DROP POLICY IF EXISTS chat_delete ON public.quiniela_league_chat;
CREATE POLICY chat_delete ON public.quiniela_league_chat
  FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.quiniela_leagues l
      WHERE l.id = quiniela_league_chat.league_id
        AND l.owner_id = (SELECT auth.uid())
    )
  );
