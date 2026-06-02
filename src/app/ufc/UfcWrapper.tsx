'use client'

import dynamic from 'next/dynamic'

const UfcClient = dynamic(
  () => import('./UfcClient'),
  { ssr: false }
)

export default function UfcWrapper() {
  return <UfcClient />
}
