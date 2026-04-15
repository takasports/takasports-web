const ITEMS = [
  'Mbappé anota hat-trick en el Clásico y Real Madrid remonta al Barça en el Bernabéu',
  'Celtics eliminan a los Cavaliers y avanzan a las Finales del Este por segundo año consecutivo',
  'Verstappen domina los libres del GP de España — Leclerc a 0.3s en la FP2',
  'Alcaraz y Sinner confirman semis en Roland Garros — el duelo más esperado del año',
  'UFC 302: Makhachev retiene el cinturón peso ligero con TKO en el tercer round',
  'Argentina convoca a Lautaro y De Paul para la doble fecha de Eliminatorias de junio',
  'PSG y Atlético de Madrid negocian el traspaso de Griezmann por 65 millones',
  'Lewis Hamilton debuta en rojo: primer test oficial con Ferrari en Fiorano esta semana',
]

export default function BreakingNewsBar() {
  const text = ITEMS.join('   ·   ')
  const doubled = `${text}   ·   ${text}`

  return (
    <div
      className="w-full overflow-hidden flex items-center"
      style={{
        height: 36,
        background: 'rgba(9,9,15,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 xl:px-10 w-full flex items-center gap-3 overflow-hidden">
        {/* Badge */}
        <div
          className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap" style={{ color: '#ef4444' }}>
            Último momento
          </span>
        </div>

        {/* Ticker */}
        <div className="flex-1 overflow-hidden">
          <span
            className="inline-block whitespace-nowrap text-xs animate-ticker"
            style={{ color: '#A0A0B0' }}
          >
            {doubled}
          </span>
        </div>
      </div>
    </div>
  )
}
