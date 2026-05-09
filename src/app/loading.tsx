export default function Loading() {
  return (
    <div
      className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-16 animate-pulse"
      style={{ paddingTop: 12 }}
    >
      {/* LiveStrip skeleton */}
      <div
        className="rounded-xl mb-6"
        style={{ height: 40, background: 'rgba(255,255,255,0.04)' }}
      />

      {/* HeroBlock skeleton — grid 2/3 + 1/3 */}
      <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: '2fr 1fr', height: 340 }}>
        <div className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="flex flex-col gap-1">
          <div className="flex-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="flex-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>

      {/* CompactStrip skeleton */}
      <div className="grid gap-1 mb-6" style={{ gridTemplateColumns: 'repeat(5,1fr)', height: 52 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>

      {/* QuickStrip skeleton */}
      <div className="flex gap-2 mb-8 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 rounded-xl"
            style={{ width: 200, height: 44, background: 'rgba(255,255,255,0.04)' }}
          />
        ))}
      </div>

      {/* Reels skeleton */}
      <div className="flex gap-2.5 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 rounded-2xl"
            style={{ width: 144, height: 216, background: 'rgba(255,255,255,0.05)' }}
          />
        ))}
      </div>

      {/* Feed + sidebar skeleton */}
      <div className="flex gap-8">
        <div className="flex-1 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl"
              style={{ height: 76, background: 'rgba(255,255,255,0.04)' }}
            />
          ))}
        </div>
        <div
          className="hidden lg:block flex-shrink-0 rounded-2xl"
          style={{ width: 272, height: 400, background: 'rgba(255,255,255,0.03)' }}
        />
      </div>
    </div>
  )
}
