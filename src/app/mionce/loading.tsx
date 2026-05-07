export default function MiOnceLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-24 animate-pulse" style={{ paddingTop: 40 }}>
      <div className="rounded-xl mb-2" style={{ width: 320, height: 40, background: 'rgba(147,197,253,0.07)' }} />
      <div className="rounded-lg mb-10" style={{ width: 420, height: 18, background: 'rgba(255,255,255,0.04)' }} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-2xl mx-auto w-full" style={{ maxWidth: 560, aspectRatio: '3/4', background: 'rgba(10,61,31,0.5)', border: '1px solid rgba(147,197,253,0.1)' }} />
        <div className="rounded-2xl" style={{ height: 560, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  )
}
