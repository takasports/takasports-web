// Hueco del aviso de cada noche en la página de un día del calendario.
//
// Se pinta en el servidor (la página es ISR) y un script en línea lo esconde
// ANTES del primer pintado en los navegadores que no pueden recibir avisos
// (Safari del iPhone sin instalar la web) o que ya los bloquearon. Si lo
// decidiera el componente al montar, el bloque aparecería o desaparecería a
// mitad de pantalla cuando ya se ve la lista: un salto de diseño en la página
// que más entra por Google, y el CLS de esta página está en 0 desde octubre.
//
// En una navegación interna el script no se ejecuta (React no ejecuta scripts
// que pinta él); para ese caso AgendaNocheCta hace la misma comprobación al
// montar.

import AgendaNocheCta from './AgendaNocheCta'

const OCULTAR_SIN_AVISOS = `(function(){try{var s=document.currentScript,w=s&&s.previousElementSibling;if(!w)return;if(!('serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window)||Notification.permission==='denied')w.hidden=true}catch(e){}})()`

export default function AgendaNoche() {
  // Sin clave VAPID no hay avisos que ofrecer.
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null
  return (
    <>
      <div data-agenda suppressHydrationWarning>
        <AgendaNocheCta />
      </div>
      <script dangerouslySetInnerHTML={{ __html: OCULTAR_SIN_AVISOS }} />
    </>
  )
}
