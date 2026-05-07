import { redirect } from 'next/navigation'
import RankingsAdmin from './RankingsAdmin'

type SP = { token?: string | string[] }

export const metadata = {
  title: 'Admin Rankings — Índice Taka',
  robots: { index: false, follow: false },
}

export default async function AdminRankingsPage(
  { searchParams }: { searchParams: Promise<SP> }
) {
  const sp = await searchParams
  const token = Array.isArray(sp.token) ? sp.token[0] : (sp.token ?? '')

  // Verificación básica de token (no muestra nada si falta o es incorrecto)
  const expected = process.env.RANKINGS_ADMIN_TOKEN
  if (!token || !expected || token !== expected) {
    redirect('/?admin=unauthorized')
  }

  return <RankingsAdmin token={token} />
}
