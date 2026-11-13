// Prueba cerrada de la app de Android en Google Play (aprobada el 12/11/2026).
//
// Una cuenta de Play personal no puede publicar en producción hasta tener 12
// testers durante 14 días seguidos. Los testers entran por un Grupo de Google
// abierto (cualquiera puede unirse) y luego aceptan la prueba en Play. Lo
// cuentan el aviso de PWAManager (solo móviles Android) y la página /android.
//
// Cuando la app salga a producción: quitar el aviso y dejar /android
// redirigiendo a PLAY_URL.

export const GROUP_URL = 'https://groups.google.com/g/taka-sports-testers'
export const OPTIN_URL = 'https://play.google.com/apps/testing/com.takasportsmedia.app'
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.takasportsmedia.app'
export const IOS_URL = 'https://apps.apple.com/es/app/id6787799706'

// Plazas que quedan del «grupo fundador» de 12. Se actualiza A MANO mirando
// los miembros del grupo: Google no deja leer ese número desde la web.
// 13/11/2026: 1 tester (Kun) → 11.
export const PLAZAS_LIBRES: number = 11

// localStorage. JOINED se marca al tocar el paso 3 (instalar): desde entonces
// el aviso no vuelve a salir en ese móvil. SNOOZE guarda el ms en que se cerró
// o se tocó el aviso: vuelve a salir pasados 15 minutos.
export const JOINED_KEY = 'taka:android-beta-joined'
export const SNOOZE_KEY = 'taka:android-beta-snooze'
export const SNOOZE_MS = 15 * 60 * 1000
