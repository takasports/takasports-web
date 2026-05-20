// Archivo rejugable de TakaGrid. La fecha llega por URL (YYYY-MM-DD) y se
// regenera el mismo puzzle determinístamente con getDailyPuzzle(d). Es modo
// libre: no toca racha, ni leaderboard, ni XP.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { getDailyPuzzle, getValidAnswers } from '@/lib/takagrid-puzzles'
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
  }
}

export default async function Page({ params }: PageProps) {
  const { fecha } = await params
  const date = parseDayParam(fecha)
  if (!date) notFound()

  const { puzzle, dayKey } = getDailyPuzzle(date)
  const validAnswers = getValidAnswers(puzzle)

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">
        <div className="pt-6 sm:pt-8">
          <Link
            href="/takagrid"
            className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-colors hover:text-white"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
          >
            ← Volver al TakaGrid de hoy
          </Link>
        </div>
        <ArchivePuzzleClient puzzle={puzzle} dayKey={dayKey} validAnswers={validAnswers} />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  )
}
