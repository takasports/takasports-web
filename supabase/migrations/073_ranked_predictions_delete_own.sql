-- 073_ranked_predictions_delete_own.sql
-- Permite al usuario BORRAR su propia predicción (des-elegir un pick).
--
-- Hasta ahora ranked_predictions solo tenía políticas INSERT/SELECT/UPDATE
-- (todas auth.uid() = user_id), por lo que un DELETE desde el cliente del
-- usuario quedaba denegado por RLS en silencio (0 filas) y el pick no se
-- podía quitar nunca.
--
-- La política se acota a:
--   · filas propias  (auth.uid() = user_id)
--   · eventos AÚN abiertos (status = 'open')
-- El bloqueo fino de 30 min antes del combate lo sigue aplicando la API
-- (DELETE /api/ranked/predictions). Borrar un pick no devuelve puntos: los
-- puntos se acreditan en point_transactions/profiles solo al resolver, y un
-- evento resuelto ya no es 'open', así que no hay vía para manipular el saldo.

CREATE POLICY rp_delete_own ON public.ranked_predictions
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.ranked_events e
      WHERE e.id = ranked_predictions.event_id
        AND e.status = 'open'
    )
  );
