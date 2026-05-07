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

      {/* Match header */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* League label */}
        <Bone className="mx-auto mb-5" style={{ width: 100, height: 10 }} />

        {/* Teams row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-center gap-2 flex-1">
            <Bone style={{ width: 56, height: 56, borderRadius: 12 }} />
            <Bone style={{ width: 80, height: 14 }} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Bone style={{ width: 72, height: 36, borderRadius: 8 }} />
            <Bone style={{ width: 56, height: 10 }} />
          </div>
          <div className="flex flex-col items-center gap-2 flex-1">
            <Bone style={{ width: 56, height: 56, borderRadius: 12 }} />
            <Bone style={{ width: 80, height: 14 }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {[80, 100, 90].map((w, i) => (
          <div key={i} className="px-4 py-3">
            <Bone style={{ width: w, height: 10 }} />
          </div>
        ))}
      </div>

      {/* Stats section */}
      <div className="rounded-xl p-4 mb-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Bone className="mb-4" style={{ width: 80, height: 9 }} />
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Bone style={{ width: 40, height: 10 }} />
              <Bone className="flex-1" style={{ height: 8, borderRadius: 999 }} />
              <Bone style={{ width: 40, height: 10 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Events section */}
      <div className="rounded-xl p-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Bone className="mb-4" style={{ width: 80, height: 9 }} />
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => (
            <Bone key={i} style={{ height: 36 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
