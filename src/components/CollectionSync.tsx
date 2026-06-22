'use client'

// Sincroniza el álbum de cracks y los onces guardados con el servidor cuando
// el usuario inicia sesión (fusiona lo local + baja el servidor a la cache) y
// los limpia al cerrar sesión. No pinta nada. Montado en ClientOnlyLayoutScripts.
//
// CLAVE: en @supabase/auth-js el evento SIGNED_IN se REEMITE al volver a la
// pestaña y al refrescar el token, no solo al hacer login. Por eso gateamos por
// id de usuario: solo sincronizamos cuando cambia el usuario (login real o
// cambio de cuenta). Así un reemit espurio del MISMO usuario es un no-op y la
// bajada del servidor NUNCA pisa una escritura local optimista en vuelo.
//
// Además, INITIAL_SESSION sincroniza UNA vez por sesión de navegador
// (sessionStorage) para no martillear las rutas en cada carga.

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { syncAlbumOnAuth, clearAlbumOnLogout } from '@/lib/album'
import { syncSavedOnAuth, clearSavedOnLogout } from '@/lib/mionce-saved'

const SESSION_FLAG = 'ts_collection_synced'

export default function CollectionSync() {
  useEffect(() => {
    const sb = createClient()
    if (!sb) return

    // Último usuario para el que ya disparamos sync en esta vida del módulo.
    // Colapsa los reemits de SIGNED_IN (refocus / token refresh) a no-op.
    let lastSyncedUid: string | null = null

    const syncAll = (uid: string) => {
      lastSyncedUid = uid
      void syncAlbumOnAuth(uid)
      void syncSavedOnAuth(uid)
    }

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null

      if (event === 'SIGNED_OUT') {
        lastSyncedUid = null
        try { sessionStorage.removeItem(SESSION_FLAG) } catch { /* ignore */ }
        clearAlbumOnLogout()
        clearSavedOnLogout()
        return
      }

      if (!uid) return

      if (event === 'SIGNED_IN') {
        // Login real o cambio de cuenta → sincroniza. Reemit del mismo usuario
        // (volver a la pestaña, refresh de token) → no-op.
        if (uid === lastSyncedUid) return
        try { sessionStorage.setItem(SESSION_FLAG, '1') } catch { /* ignore */ }
        syncAll(uid)
      } else if (event === 'INITIAL_SESSION') {
        // Una vez por sesión de navegador: la cache local queda hidratada.
        lastSyncedUid = uid
        let already = false
        try { already = !!sessionStorage.getItem(SESSION_FLAG) } catch { /* ignore */ }
        if (already) return
        try { sessionStorage.setItem(SESSION_FLAG, '1') } catch { /* ignore */ }
        void syncAlbumOnAuth(uid)
        void syncSavedOnAuth(uid)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  return null
}
