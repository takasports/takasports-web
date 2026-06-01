'use client'

// Wrapper de componentes client-only que se renderizan globalmente pero NO
// aportan al HTML inicial. Los cargamos via dynamic({ ssr: false }) para
// liberar el bundle JS inicial:
//
//  · PorraSettlementToast — toast post-jornada de La Porra. Solo aparece para
//    usuarios autenticados con predicciones liquidadas. ~10 KiB.
//  · BadgeUnlockProvider — modal celebratorio de badges desbloqueados. Solo
//    para usuarios autenticados. ~5 KiB.
//
// next/dynamic con ssr:false debe vivir DENTRO de un Client Component en
// Next 16 — por eso este wrapper existe. El root layout es Server Component
// y no puede usar ssr:false directamente.

import dynamic from 'next/dynamic'

const PorraSettlementToast = dynamic(() => import('./PorraSettlementToast'), { ssr: false })
const BadgeUnlockProvider  = dynamic(() => import('./badges/BadgeUnlockProvider'), { ssr: false })

export default function ClientOnlyLayoutScripts() {
  return (
    <>
      <PorraSettlementToast />
      <BadgeUnlockProvider />
    </>
  )
}
