export default function TakaGridLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24 animate-pulse" style={{ paddingTop: 40 }}>
      <div className="rounded-xl mb-2" style={{ width: 280, height: 40, background: 'rgba(253,186,116,0.07)' }} />
      <div className="rounded-lg mb-10" style={{ width: 380, height: 18, background: 'rgba(255,255,255,0.04)' }} />
      <div className="rounded-2xl mx-auto" style={{ maxWidth: 560, height: 520, background: 'rgba(253,186,116,0.05)', border: '1px solid rgba(253,186,116,0.1)' }} />
    </div>
  )
}
