export default function QuinielaLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-24 animate-pulse" style={{ paddingTop: 40 }}>
      {/* Title */}
      <div className="rounded-xl mb-2" style={{ width: 220, height: 36, background: 'rgba(255,255,255,0.07)' }} />
      <div className="rounded-lg mb-8" style={{ width: 300, height: 18, background: 'rgba(255,255,255,0.04)' }} />

      {/* Match cards */}
      <div className="flex flex-col gap-4" style={{ maxWidth: 680, margin: '0 auto' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl" style={{ height: 140, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }} />
        ))}
      </div>

      {/* CTA button */}
      <div className="mx-auto mt-8 rounded-xl" style={{ maxWidth: 680, height: 52, background: 'rgba(124,58,237,0.08)' }} />
    </div>
  )
}
