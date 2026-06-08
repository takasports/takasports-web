// Archivo rejugable de TakaGrid. La fecha llega por URL (YYYY-MM-DD) y se
// regenera el mismo puzzle determinístamente con getDailyPuzzle(d). Es modo
// libre: no toca racha, ni leaderboard, ni XP.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import GameLayout from '@/components/games/GameLayout'
import { SITE_URL } from '@/lib/constants'
import ArchivePuzzleClient from './ArchivePuzzleClient'

interface PageProps {
  params: Promise<{ fecha: string }>
}

function parseDayParam(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(s + 'T12:00:00Z')
  if (Number.isNaN(d.getTime())) return null
  // No permitir fechas futuras
  if (d.getTime() > Date.now() + 86400000) return null
  return d
}

export async function generateMetadata({ params }: PageProps) {
  const { fecha } = await params
  return {
    title: `TakaGrid · Archivo · ${fecha}`,
    description: `Resuelve el TakaGrid del ${fecha} sin presión: no cuenta para el ranking ni la racha.`,
    // Archivo rejugable: no indexar (cualquier fecha genera una URL casi idéntica → thin/duplicate content).
    robots: { index: false, follow: true },
    // Self-canonical: sobrescribe el del layout padre que apunta a /takagrid
    alternates: { canonical: `${SITE_URL}/takagrid/${fecha}` },
  }
}

export default async function Page({ params }: PageProps) {
  const { fecha } = await params
  // Validación server-side (formato + no futuro). El puzzle se computa en el
  // cliente a partir de la fecha: el grid lleva funciones `test` en filas/cols,
  // que NO se pueden serializar a través del límite servidor→cliente (RSC).
  if (!parseDayParam(fecha)) notFound()

  return (
    <GameLayout accent="#FDBA74" accentDim="#F97316">
      <div className="pt-6 sm:pt-8">
        <Link
          href="/takagrid"
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-colors hover:text-white"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
        >
          ← Volver al TakaGrid de hoy
        </Link>
      </div>
      <ArchivePuzzleClient fecha={fecha} />
    </GameLayout>
  )
}
