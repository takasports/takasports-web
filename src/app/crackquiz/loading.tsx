export default function CrackQuizLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-24 animate-pulse" style={{ paddingTop: 40 }}>
      <div className="rounded-xl mb-2" style={{ width: 280, height: 40, background: 'rgba(255,255,255,0.07)' }} />
      <div className="rounded-lg mb-10" style={{ width: 380, height: 18, background: 'rgba(255,255,255,0.04)' }} />

      <div className="max-w-2xl mx-auto">
        {/* progress bar */}
        <div className="rounded-full mb-6" style={{ height: 6, background: 'rgba(255,255,255,0.06)' }} />

        {/* question card */}
        <div className="rounded-2xl p-8 mb-6" style={{ background: 'rgba(252,211,77,0.05)', border: '1px solid rgba(252,211,77,0.1)' }}>
          <div className="rounded-lg mb-3" style={{ width: '60%', height: 16, background: 'rgba(255,255,255,0.06)' }} />
          <div className="rounded-lg mb-1" style={{ width: '90%', height: 22, background: 'rgba(255,255,255,0.08)' }} />
          <div className="rounded-lg" style={{ width: '70%', height: 22, background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* options */}
        <div className="grid grid-cols-1 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-xl" style={{ height: 52, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
