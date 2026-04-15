export default function Loading() {
  return (
    <div
      className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-16 animate-pulse"
      style={{ paddingTop: 16 }}
    >
      {/* Reels skeleton */}
      <div className="flex gap-2.5 pt-6 pb-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 rounded-2xl"
            style={{ width: 144, height: 216, background: 'rgba(255,255,255,0.05)' }}
          />
        ))}
      </div>

      {/* Live events skeleton */}
      <div className="flex gap-2.5 py-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 rounded-xl"
            style={{ width: 192, height: 96, background: 'rgba(255,255,255,0.04)' }}
          />
        ))}
      </div>

      {/* Featured skeleton */}
      <div
        className="w-full rounded-2xl mt-3"
        style={{ height: 340, background: 'rgba(255,255,255,0.05)' }}
      />

      {/* Secondary skeleton */}
      <div
        className="grid gap-px mt-0.5"
        style={{
          gridTemplateColumns: 'repeat(3,1fr)',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '0 0 14px 14px',
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ height: 68, background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>

      {/* Feed skeleton */}
      <div className="flex flex-col gap-1.5 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl"
            style={{ height: 76, background: 'rgba(255,255,255,0.04)' }}
          />
        ))}
      </div>
    </div>
  )
}
