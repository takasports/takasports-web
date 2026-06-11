function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-xl${className ? ` ${className}` : ''}`}
      style={{ background: 'rgba(255,255,255,0.06)', ...style }}
    />
  )
}

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back link */}
      <Bone className="mb-6" style={{ width: 80, height: 16 }} />

      {/* Team header */}
      <div
        className="rounded-2xl p-5 mb-6 flex items-center gap-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Bone style={{ width: 80, height: 80, borderRadius: 'var(--radius-lg)', flexShrink: 0 }} />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <Bone style={{ width: 80, height: 10 }} />
          <Bone style={{ width: 200, height: 24 }} />
          <Bone style={{ width: 140, height: 14 }} />
        </div>
        <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
          <Bone style={{ width: 72, height: 24, borderRadius: 999 }} />
          <Bone style={{ width: 56, height: 28, borderRadius: 999 }} />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-xl p-3 flex flex-col items-center gap-2"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Bone style={{ width: 32, height: 24 }} />
            <Bone style={{ width: 56, height: 10 }} />
          </div>
        ))}
      </div>

      {/* Form badges */}
      <div className="flex items-center gap-3 mb-6">
        <Bone style={{ width: 40, height: 10 }} />
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map(i => (
            <Bone key={i} style={{ width: 28, height: 28 }} />
          ))}
        </div>
      </div>

      {/* Featured player */}
      <div className="rounded-2xl p-5 mb-6 flex gap-4 items-center"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <Bone style={{ width: 72, height: 72, borderRadius: 'var(--radius-card)', flexShrink: 0 }} />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <Bone style={{ width: 80, height: 10, borderRadius: 999 }} />
          <Bone style={{ width: 160, height: 20 }} />
          <Bone style={{ width: 120, height: 12 }} />
        </div>
        <div className="flex gap-4 flex-shrink-0">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Bone style={{ width: 28, height: 24 }} />
              <Bone style={{ width: 28, height: 10 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {['Resultados', 'Plantilla', 'Clasificación'].map((t, i) => (
          <div key={t} className="px-4 py-3">
            <Bone style={{ width: t.length * 7, height: 10 }} />
          </div>
        ))}
      </div>

      {/* Content rows */}
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Bone key={i} style={{ height: 52 }} />
        ))}
      </div>
    </div>
  )
}
