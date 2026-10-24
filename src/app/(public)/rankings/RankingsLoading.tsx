export default function RankingsLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-16 animate-pulse" style={{ paddingTop: 40 }}>
      {/* Title */}
      <div className="rounded-xl mb-2" style={{ width: 200, height: 36, background: 'rgba(255,255,255,0.07)' }} />
      <div className="rounded-lg mb-8" style={{ width: 320, height: 18, background: 'rgba(255,255,255,0.04)' }} />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-full" style={{ width: 100, height: 36, background: 'rgba(255,255,255,0.05)' }} />
        ))}
      </div>

      {/* Podium skeleton */}
      <div className="grid grid-cols-3 gap-4 mb-8" style={{ maxWidth: 560, margin: '0 auto 2rem' }}>
        <div className="rounded-2xl" style={{ height: 180, background: 'rgba(255,255,255,0.05)' }} />
        <div className="rounded-2xl" style={{ height: 220, background: 'rgba(255,255,255,0.07)' }} />
        <div className="rounded-2xl" style={{ height: 160, background: 'rgba(255,255,255,0.04)' }} />
      </div>

      {/* List rows */}
      <div className="flex flex-col gap-2" style={{ maxWidth: 720, margin: '0 auto' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-xl flex items-center gap-3 px-4" style={{ height: 56, background: 'rgba(255,255,255,0.04)' }}>
            <div className="rounded" style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.06)' }} />
            <div className="rounded flex-1" style={{ height: 14, background: 'rgba(255,255,255,0.05)' }} />
            <div className="rounded" style={{ width: 40, height: 20, background: 'rgba(255,255,255,0.06)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
