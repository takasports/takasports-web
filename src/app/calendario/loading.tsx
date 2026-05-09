export default function CalendarioLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-16 animate-pulse" style={{ paddingTop: 40 }}>
      {/* Title */}
      <div className="rounded-xl mb-2" style={{ width: 200, height: 36, background: 'rgba(255,255,255,0.07)' }} />
      <div className="rounded-lg mb-6" style={{ width: 280, height: 18, background: 'rgba(255,255,255,0.04)' }} />

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 rounded-full" style={{ height: 36, background: 'rgba(255,255,255,0.04)' }} />
        <div className="rounded-lg" style={{ width: 80, height: 36, background: 'rgba(255,255,255,0.04)' }} />
      </div>

      {/* Date group */}
      <div className="rounded-full mx-auto mb-4" style={{ width: 80, height: 20, background: 'rgba(255,255,255,0.04)' }} />

      {/* Event cards */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl" style={{ height: 72, background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>

      {/* Date group 2 */}
      <div className="rounded-full mx-auto my-4" style={{ width: 80, height: 20, background: 'rgba(255,255,255,0.03)' }} />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl" style={{ height: 72, background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    </div>
  )
}
