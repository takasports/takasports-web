'use client'

// /badges — Colección pública de badges de TakaSports.
// Muestra todos los badges del catálogo agrupados por categoría.
// Si el usuario está autenticado, marca los que ha desbloqueado (fetch /api/quiniela/me).

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { listAllBadges } from '@/lib/badges'
import type { BadgeDef, BadgeCategory } from '@/lib/badges'
import { createClient } from '@/lib/supabase'

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  milestone: 'Hitos',
  jornada:   'Jornada',
  season:    'Temporada',
  mundial:   'Mundial',
  special:   'Especiales',
}

const RARITY_LABEL: Record<string, string> = {
  common:    'Común',
  rare:      'Raro',
  epic:      'Épico',
  legendary: 'Legendario',
}

const RARITY_COLOR: Record<string, string> = {
  common:    '#94a3b8',
  rare:      '#60a5fa',
  epic:      '#c084fc',
  legendary: '#fbbf24',
}

export default function BadgesPage() {
  const allBadges = listAllBadges()
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set())
  const [unlockedAt, setUnlockedAt]   = useState<Record<string, string>>({})
  const [authed, setAuthed] = useState(false)

  // Check auth + fetch unlocked badges
  useEffect(() => {
    const sb = createClient()
    if (!sb) return
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setAuthed(true)
      fetch('/api/quiniela/me')
        .then(r => r.ok ? r.json() : null)
        .then((d: { badges?: { id: string; unlockedAt: string | null }[] } | null) => {
          if (!d?.badges) return
          const ids = new Set<string>()
          const dates: Record<string, string> = {}
          for (const b of d.badges) {
            if (b.unlockedAt) {
              ids.add(b.id)
              dates[b.id] = b.unlockedAt
            }
          }
          setUnlockedIds(ids)
          setUnlockedAt(dates)
        })
        .catch(() => { /* ignore */ })
    })
  }, [])

  // Group by category
  const grouped = allBadges.reduce<Record<BadgeCategory, BadgeDef[]>>((acc, b) => {
    if (!acc[b.category]) acc[b.category] = []
    acc[b.category].push(b)
    return acc
  }, {} as Record<BadgeCategory, BadgeDef[]>)

  const categoryOrder: BadgeCategory[] = ['milestone', 'jornada', 'season', 'mundial', 'special']

  return (
    <>
      <Header />
      <main
        className="min-h-screen"
        style={{ background: 'var(--bg-body)', paddingTop: 80 }}
      >
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-10">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Link href="/juegos" className="text-[11px] transition-opacity hover:opacity-70" style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}>
                Juegos
              </Link>
              <span style={{ color: '#3A3A5A', fontSize: 10 }}>›</span>
              <span className="text-[11px]" style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}>Badges</span>
            </div>
            <h1
              className="text-2xl font-black"
              style={{ fontFamily: 'var(--font-display)', color: '#F0F0F8', letterSpacing: '-0.02em' }}
            >
              Colección de Badges
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              {allBadges.length} badges disponibles
              {authed && unlockedIds.size > 0 && ` · ${unlockedIds.size} desbloqueados`}
            </p>
          </div>

          {/* Groups */}
          {categoryOrder.map(cat => {
            const badges = grouped[cat]
            if (!badges?.length) return null
            return (
              <section key={cat} className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="section-accent" />
                  <h2 className="section-label">{CATEGORY_LABELS[cat]}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {badges.map(badge => {
                    const unlocked = unlockedIds.has(badge.id)
                    const date = unlockedAt[badge.id]
                    return (
                      <div
                        key={badge.id}
                        className="rounded-2xl px-4 py-4 flex gap-3 items-start transition-opacity"
                        style={{
                          background: unlocked ? badge.bg : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${unlocked ? badge.color + '40' : 'rgba(255,255,255,0.06)'}`,
                          opacity: !authed || unlocked ? 1 : 0.45,
                        }}
                      >
                        <div
                          className="flex items-center justify-center rounded-xl flex-shrink-0"
                          style={{
                            width: 40, height: 40,
                            background: unlocked ? badge.bg : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${unlocked ? badge.color + '30' : 'rgba(255,255,255,0.08)'}`,
                            fontSize: 20,
                            filter: unlocked ? 'none' : 'grayscale(1)',
                          }}
                        >
                          {badge.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="text-[13px] font-black"
                              style={{ color: unlocked ? badge.color : '#4A4A6A', fontFamily: 'var(--font-display)' }}
                            >
                              {badge.name}
                            </span>
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={{
                                background: `${RARITY_COLOR[badge.rarity]}18`,
                                color: RARITY_COLOR[badge.rarity],
                                border: `1px solid ${RARITY_COLOR[badge.rarity]}30`,
                                fontFamily: 'var(--font-sport)',
                              }}
                            >
                              {RARITY_LABEL[badge.rarity]}
                            </span>
                          </div>
                          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                            {badge.description}
                          </p>
                          {unlocked && date && (
                            <p className="text-[10px] mt-1" style={{ color: badge.color, opacity: 0.7, fontFamily: 'var(--font-sport)' }}>
                              Desbloqueado {new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                          {badge.unlocks?.title && (
                            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(167,139,250,0.5)', fontFamily: 'var(--font-sport)' }}>
                              Desbloquea título: &ldquo;{badge.unlocks.title}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {/* CTA si no hay sesión */}
          {!authed && (
            <div
              className="rounded-2xl px-6 py-6 text-center mt-4"
              style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}
            >
              <p className="text-sm font-black" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
                Inicia sesión para ver tus badges desbloqueados
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                Juega en la quiniela, el Ranked y los juegos para desbloquear badges.
              </p>
              <Link
                href="/quiniela"
                className="inline-block mt-3 text-[12px] font-black px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
                style={{
                  background: 'rgba(124,58,237,0.15)',
                  border: '1px solid rgba(124,58,237,0.35)',
                  color: '#C4B5FD',
                  fontFamily: 'var(--font-display)',
                  textDecoration: 'none',
                }}
              >
                Ir a la Quiniela →
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
