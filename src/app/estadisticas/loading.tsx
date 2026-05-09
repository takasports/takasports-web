export default function EstadisticasLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-16 animate-pulse" style={{ paddingTop: 40 }}>
      {/* Title */}
      <div className="rounded-xl mb-2" style={{ width: 220, height: 36, background: 'rgba(255,255,255,0.07)' }} />
      <div className="rounded-lg mb-8" style={{ width: 360, height: 18, background: 'rgba(255,255,255,0.04)' }} />

      {/* Sport tabs */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-full" style={{ width: 90, height: 36, background: 'rgba(255,255,255,0.05)' }} />
        ))}
      </div>

      {/* Stat blocks grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="p-5">
              <div className="rounded-lg mb-4" style={{ width: 140, height: 20, background: 'rgba(255,255,255,0.06)' }} />
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="rounded" style={{ width: 20, height: 20, background: 'rgba(255,255,255,0.05)' }} />
                    <div className="rounded flex-1" style={{ height: 14, background: 'rgba(255,255,255,0.04)' }} />
                    <div className="rounded" style={{ width: 32, height: 20, background: 'rgba(255,255,255,0.06)' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
