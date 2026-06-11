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
      <Bone className="mb-6" style={{ width: 150, height: 16 }} />

      <div
        className="rounded-2xl p-5 mb-6 flex items-center gap-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Bone style={{ width: 80, height: 80, borderRadius: 16, flexShrink: 0 }} />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <Bone style={{ width: 90, height: 10 }} />
          <Bone style={{ width: 200, height: 24 }} />
          <Bone style={{ width: 160, height: 12 }} />
          <Bone style={{ width: 110, height: 12 }} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl p-3 flex flex-col items-center gap-2"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Bone style={{ width: 32, height: 24 }} />
            <Bone style={{ width: 48, height: 10 }} />
          </div>
        ))}
      </div>

      <Bone className="mb-3" style={{ width: 120, height: 10 }} />
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Bone key={i} style={{ height: 48 }} />
        ))}
      </div>
    </div>
  )
}
