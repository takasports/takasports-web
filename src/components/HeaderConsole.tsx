import Header from './Header'
import LiveStrip from './LiveStrip'

// Consola "La Señal": apila el Header y la franja de marcadores (LiveStrip) como
// un único bloque STICKY, de modo que el directo no se pierde al hacer scroll
// (antes el LiveStrip iba dentro del contenido de cada página y desaparecía al
// bajar). El Header se monta con sticky={false} porque es ESTE contenedor el que
// se fija al top; así Header + LiveStrip viajan juntos como una sola consola.
//
// Se usa solo en (public)/layout.tsx. home/calendario montan <Header /> directo
// (sticky propio, sin consola) = territorio del calendario, intacto.
//
// LiveStrip ya hace su propio autofetch del directo y se colapsa al bajar en
// móvil; dentro de la consola eso lo minimiza dejando el Header visible.
export default function HeaderConsole() {
  return (
    <div className="sticky top-0 z-50">
      <Header sticky={false} />
      <LiveStrip />
    </div>
  )
}
