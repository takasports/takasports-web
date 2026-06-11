
function SkeletonBlock({ rows = 5, wide = false }: { rows?: number; wide?: boolean }) {
  return (
    <div
      className={wide ? 'md:col-span-2 xl:col-span-1' : ''}
      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, overflow: 'hidden' }}
    >
      {/* Block header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="rounded-lg" style={{ width: 140, height: 18, background: 'rgba(255,255,255,0.07)' }} />
        <div className="rounded-full" style={{ width: 44, height: 16, background: 'rgba(255,255,255,0.04)' }} />
      </div>
      {/* Rows */}
      <div className="px-5 py-3 flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, j) => (
          <div key={j} className="flex items-center gap-3">
            <div className="rounded" style={{ width: 18, height: 14, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
            <div className="rounded flex-1" style={{ height: 13, background: 'rgba(255,255,255,0.04)' }} />
            <div className="rounded" style={{ width: 28, height: 18, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function EstadisticasLoading() {
  return (
    <>
      {/* LiveStrip real: ocupa su sitio desde el primer paint para que al hidratar
          el contenido no haya salto de layout (CLS). El Header lo aporta (public)/layout. */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24 animate-pulse" style={{ paddingTop: 32 }}>
      {/* Title + subtitle */}
      <div className="rounded-xl mb-2" style={{ width: 220, height: 34, background: 'rgba(255,255,255,0.07)' }} />
      <div className="rounded-lg mb-8" style={{ width: 340, height: 16, background: 'rgba(255,255,255,0.04)' }} />

      {/* Sport tabs */}
      <div className="flex gap-2 mb-6 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-full flex-shrink-0" style={{ width: 88, height: 34, background: 'rgba(255,255,255,0.05)' }} />
        ))}
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 mb-6 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-full flex-shrink-0" style={{ width: 70, height: 26, background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>

      {/* Stat blocks — first row: 3 standard */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        <SkeletonBlock rows={5} />
        <SkeletonBlock rows={5} />
        <SkeletonBlock rows={5} />
      </div>

      {/* Second row: 2 standard + 1 taller */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        <SkeletonBlock rows={6} />
        <SkeletonBlock rows={4} />
        <SkeletonBlock rows={8} />
      </div>

      {/* Third row: 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SkeletonBlock rows={5} />
        <SkeletonBlock rows={5} />
        <SkeletonBlock rows={5} />
      </div>
    </div>
    </>
  )
}
