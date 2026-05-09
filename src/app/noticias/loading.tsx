export default function NoticiasLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-16 animate-pulse" style={{ paddingTop: 16 }}>
      {/* LiveStrip skeleton */}
      <div className="rounded-xl mb-5" style={{ height: 40, background: 'rgba(255,255,255,0.04)' }} />

      {/* Hero 2-col */}
      <div className="grid gap-1 mb-4" style={{ gridTemplateColumns: '2fr 1fr', height: 320 }}>
        <div className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="flex flex-col gap-1">
          <div className="flex-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="flex-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>

      {/* Reels strip */}
      <div className="flex gap-2.5 mb-6 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 rounded-2xl" style={{ width: 144, height: 216, background: 'rgba(255,255,255,0.05)' }} />
        ))}
      </div>

      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 rounded-full" style={{ height: 36, background: 'rgba(255,255,255,0.04)' }} />
        <div className="rounded-lg" style={{ width: 72, height: 36, background: 'rgba(255,255,255,0.04)' }} />
      </div>

      {/* Feed skeleton */}
      <div className="flex gap-8">
        <div className="flex-1 flex flex-col gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-xl" style={{ height: 76, background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
        <div className="hidden lg:block flex-shrink-0 rounded-2xl" style={{ width: 272, height: 400, background: 'rgba(255,255,255,0.03)' }} />
      </div>
    </div>
  )
}
