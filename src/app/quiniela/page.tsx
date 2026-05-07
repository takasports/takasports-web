'use client'

import dynamic from 'next/dynamic'
import QuinielaLoading from './loading'

const QuinielaClient = dynamic(() => import('./QuinielaClient'), {
  loading: () => <QuinielaLoading />,
  ssr: false,
})

export default function QuinielaPage() {
  return <QuinielaClient />
}
