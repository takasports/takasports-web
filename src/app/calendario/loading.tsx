// Loading skeleton para /calendario.
// Mimetiza la estructura real (cabecera con kicker púrpura, 3 tabs,
// día separator con gradiente, tarjetas vs centradas) para reducir
// la sensación de salto en el primer paint.

const bar = 'rgba(255,255,255,0.05)'
const barSoft = 'rgba(255,255,255,0.03)'

function MatchSkeleton() {
  return (
    <div
      className="grid items-center gap-2 px-3 py-3 rounded-lg"
      style={{
        gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
        background: barSoft,
        border: '1px solid rgba(255,255,255,0.04)',
        borderLeftWidth: 3,
        borderLeftColor: 'rgba(124,58,237,0.35)',
      }}
    >
      {/* Home */}
      <div className="flex items-center gap-2.5 justify-end">
        <div style={{ height: 12, width: 88, background: bar, borderRadius: 4 }} />
        <div style={{ width: 32, height: 32, background: bar, borderRadius: 999 }} />
      </div>
      {/* Score */}
      <div className="flex flex-col items-center gap-1 min-w-[88px] px-2">
        <div style={{ height: 8, width: 30, background: barSoft, borderRadius: 4 }} />
        <div style={{ height: 22, width: 56, background: bar, borderRadius: 4 }} />
      </div>
      {/* Away */}
      <div className="flex items-center gap-2.5">
        <div style={{ width: 32, height: 32, background: bar, borderRadius: 999 }} />
        <div style={{ height: 12, width: 88, background: bar, borderRadius: 4 }} />
      </div>
    </div>
  )
}

function DaySeparatorSkeleton() {
  return (
    <div className="relative pt-7 pb-4 mb-3">
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: 2,
          background: 'linear-gradient(90deg, rgba(124,58,237,0.32) 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.04) 100%)',
        }}
      />
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="block rounded-sm"
            style={{ width: 4, height: 28, background: 'rgba(124,58,237,0.55)', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}
          />
          <div className="flex flex-col gap-2">
            <div style={{ height: 22, width: 110, background: bar, borderRadius: 4 }} />
            <div style={{ height: 10, width: 150, background: barSoft, borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ height: 20, width: 28, background: barSoft, borderRadius: 999 }} />
      </div>
    </div>
  )
}

export default function CalendarioLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-10 pb-24 animate-pulse">
      {/* Header */}
      <div className="pt-6 pb-5">
        {/* Kicker: barra acento + label */}
        <div className="flex items-center gap-2.5 mb-3">
          <span className="block rounded-sm" style={{ width: 3, height: 14, background: 'rgba(124,58,237,0.55)' }} />
          <div style={{ height: 10, width: 60, background: bar, borderRadius: 4 }} />
        </div>
        {/* H1 grande */}
        <div style={{ height: 44, width: 280, background: bar, borderRadius: 8, marginBottom: 8 }} />
        {/* Meta */}
        <div style={{ height: 12, width: 180, background: barSoft, borderRadius: 4 }} />

        {/* TZ */}
        <div className="mt-4" style={{ height: 32, width: 160, background: barSoft, borderRadius: 8 }} />

        {/* Tabs row */}
        <div className="flex items-center justify-between gap-2 mt-5">
          <div className="flex gap-2">
            <div style={{ height: 32, width: 80, background: 'rgba(124,58,237,0.18)', borderRadius: 999, border: '1px solid rgba(124,58,237,0.4)' }} />
            <div style={{ height: 32, width: 96, background: bar, borderRadius: 999 }} />
            <div style={{ height: 32, width: 96, background: bar, borderRadius: 999 }} />
          </div>
          <div style={{ width: 36, height: 36, background: bar, borderRadius: 999 }} />
        </div>
      </div>

      {/* Sticky toolbar zone */}
      <div className="flex items-center gap-2 mb-4">
        <div style={{ height: 28, width: 64, background: barSoft, borderRadius: 999 }} />
        <div style={{ height: 28, width: 64, background: barSoft, borderRadius: 999 }} />
        <div style={{ height: 28, width: 64, background: barSoft, borderRadius: 999 }} />
        <div style={{ height: 28, width: 28, background: barSoft, borderRadius: 999 }} />
      </div>

      {/* Sport sub-tabs (underline style) */}
      <div className="flex items-center gap-4 mb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
        <div style={{ height: 14, width: 48, background: bar, borderRadius: 4 }} />
        <div style={{ height: 14, width: 60, background: barSoft, borderRadius: 4 }} />
        <div style={{ height: 14, width: 44, background: barSoft, borderRadius: 4 }} />
        <div style={{ height: 14, width: 56, background: barSoft, borderRadius: 4 }} />
      </div>

      {/* Day 1 */}
      <DaySeparatorSkeleton />
      <div className="space-y-2 mb-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <MatchSkeleton key={`d1-${i}`} />
        ))}
      </div>

      {/* Day 2 */}
      <DaySeparatorSkeleton />
      <div className="space-y-2 mb-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <MatchSkeleton key={`d2-${i}`} />
        ))}
      </div>
    </div>
  )
}
