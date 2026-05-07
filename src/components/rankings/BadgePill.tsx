export default function BadgePill({ text }: { text: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    Nuevo:      { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e', border: 'rgba(34,197,94,0.25)' },
    Revelacion: { bg: 'rgba(124,58,237,0.12)', color: '#C4B5FD', border: 'rgba(124,58,237,0.3)' },
    Revelación: { bg: 'rgba(124,58,237,0.12)', color: '#C4B5FD', border: 'rgba(124,58,237,0.3)' },
    Histórico:  { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  }
  const c = colors[text] ?? colors['Nuevo']
  return (
    <span
      className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: 'var(--font-sport)' }}
    >
      {text}
    </span>
  )
}
