export default function PerfilLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24 animate-pulse" style={{ paddingTop: 40 }}>

      {/* Hero */}
      <div className="flex items-start gap-5 pb-10">
        <div className="flex-shrink-0 rounded-2xl" style={{ width: 80, height: 80, background: 'rgba(124,58,237,0.15)' }} />
        <div className="flex flex-col gap-3 flex-1">
          <div className="rounded-xl" style={{ width: 200, height: 32, background: 'rgba(255,255,255,0.07)' }} />
          <div className="rounded-lg" style={{ width: 280, height: 16, background: 'rgba(255,255,255,0.04)' }} />
          <div className="rounded-lg" style={{ width: 140, height: 14, background: 'rgba(255,255,255,0.03)' }} />
        </div>
      </div>

      {/* Main grid */}
      <div className="flex flex-col lg:flex-row gap-8">

        {/* Left */}
        <div className="flex-1 flex flex-col gap-10">
          {/* Section */}
          {Array.from({ length: 3 }).map((_, s) => (
            <div key={s}>
              <div className="rounded-lg mb-4" style={{ width: 160, height: 18, background: 'rgba(255,255,255,0.05)' }} />
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl" style={{ height: 60, background: 'rgba(255,255,255,0.04)' }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right */}
        <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col gap-6">
          <div className="rounded-2xl" style={{ height: 200, background: 'rgba(255,255,255,0.04)' }} />
          <div className="rounded-2xl" style={{ height: 120, background: 'rgba(255,255,255,0.04)' }} />
          <div className="rounded-2xl" style={{ height: 160, background: 'rgba(255,255,255,0.03)' }} />
        </div>

      </div>
    </div>
  )
}
