import RankingsAdmin from './RankingsAdmin'
import { requireAdmin } from '@/lib/admin-auth'

export const metadata = {
  title: 'Admin Rankings — Índice Taka',
  robots: { index: false, follow: false },
}

export default async function AdminRankingsPage() {
  await requireAdmin('/admin/rankings')
  return <RankingsAdmin />
}
