'use client'

import dynamic from 'next/dynamic'

const MundialClient = dynamic(
  () => import('./MundialClient'),
  { ssr: false }
)

export default function MundialWrapper() {
  return <MundialClient />
}
