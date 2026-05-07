import { getSportEmoji, getSportLabel } from '@/lib/sports'

interface TickerItem {
  title: string
  sport?: string
}

const FALLBACK_ITEMS: TickerItem[] = [
  { title: 'Mbappé anota hat-trick en el Clásico y Real Madrid remonta al Barça', sport: 'futbol' },
  { title: 'Celtics avanzan a las Finales del Este por segundo año consecutivo', sport: 'baloncesto' },
  { title: 'Verstappen domina los libres del GP de España — Leclerc a 0.3s', sport: 'formula1' },
  { title: 'Alcaraz y Sinner confirman semis en Roland Garros', sport: 'tenis' },
  { title: 'UFC 302: Makhachev retiene el cinturón peso ligero con TKO', sport: 'ufc' },
  { title: 'Lewis Hamilton debuta en rojo: primer test oficial con Ferrari', sport: 'formula1' },
]

function buildText(items: TickerItem[]): string {
  return items.map(item => {
    const label = item.sport ? getSportLabel(item.sport) : null
    const emoji = label ? getSportEmoji(label) : null
    return emoji ? `${emoji} ${item.title}` : item.title
  }).join('   ·   ')
}

export default function BreakingNewsBar({
  items,
  titles,
}: {
  items?: TickerItem[]
  titles?: string[]
}) {
  const resolved: TickerItem[] =
    items && items.length > 0
      ? items
      : titles && titles.length > 0
        ? titles.map(t => ({ title: t }))
        : FALLBACK_ITEMS

  const text = buildText(resolved)
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
            style={{ color: '#B4B4C8' }}
          >
            {doubled}
          </span>
        </div>
      </div>
    </div>
  )
}
