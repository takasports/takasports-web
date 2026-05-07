export default function ArticleLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-20 animate-pulse">
      <div className="lg:grid lg:gap-12" style={{ gridTemplateColumns: 'minmax(0,1fr) 268px', maxWidth: 1160, margin: '0 auto' }}>

        {/* Back button skeleton */}
        <div className="pt-6 pb-5 lg:col-span-2">
          <div className="rounded-lg" style={{ width: 80, height: 28, background: 'rgba(255,255,255,0.05)' }} />
        </div>

        {/* Article column */}
        <div>
          {/* Badges */}
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-full" style={{ width: 72, height: 26, background: 'rgba(255,255,255,0.06)' }} />
            <div className="rounded-full" style={{ width: 100, height: 26, background: 'rgba(255,255,255,0.04)' }} />
          </div>

          {/* Title */}
          <div className="rounded-xl mb-2" style={{ height: 40, background: 'rgba(255,255,255,0.07)', maxWidth: 560 }} />
          <div className="rounded-xl mb-6" style={{ height: 32, background: 'rgba(255,255,255,0.05)', maxWidth: 420 }} />

          {/* Hero image */}
          <div className="rounded-2xl mb-8 w-full" style={{ height: 'clamp(200px,40vw,400px)', background: 'rgba(255,255,255,0.06)' }} />

          {/* Body paragraphs */}
          <div className="flex flex-col gap-4" style={{ maxWidth: 680 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg" style={{ height: 20, background: 'rgba(255,255,255,0.04)', width: i % 3 === 2 ? '70%' : '100%' }} />
            ))}
            <div className="rounded-lg" style={{ height: 20, background: 'rgba(255,255,255,0.04)', width: '85%' }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`b-${i}`} className="rounded-lg" style={{ height: 20, background: 'rgba(255,255,255,0.04)', width: i === 3 ? '55%' : '100%' }} />
            ))}
          </div>
        </div>

        {/* Sidebar skeleton (desktop only) */}
        <div className="hidden lg:flex flex-col gap-4">
          <div className="rounded-2xl" style={{ height: 200, background: 'rgba(255,255,255,0.04)' }} />
          <div className="rounded-2xl" style={{ height: 120, background: 'rgba(255,255,255,0.04)' }} />
          <div className="rounded-2xl" style={{ height: 200, background: 'rgba(255,255,255,0.03)' }} />
        </div>

      </div>
    </div>
  )
}
