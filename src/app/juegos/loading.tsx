export default function JuegosLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-24 animate-pulse" style={{ paddingTop: 40 }}>
      {/* Title */}
      <div className="rounded-xl mb-2" style={{ width: 300, height: 40, background: 'rgba(255,255,255,0.07)' }} />
      <div className="rounded-lg mb-12" style={{ width: 380, height: 18, background: 'rgba(255,255,255,0.04)' }} />

      {/* Active game hero */}
      <div className="rounded-2xl mb-12" style={{ height: 220, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.12)' }} />

      {/* Coming games grid */}
      <div className="rounded-lg mb-6" style={{ width: 160, height: 18, background: 'rgba(255,255,255,0.05)' }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl" style={{ height: 260, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }} />
        ))}
      </div>
    </div>
  )
}
