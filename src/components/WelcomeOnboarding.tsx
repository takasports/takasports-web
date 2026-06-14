'use client'

// WelcomeOnboarding — bienvenida de UNA pantalla para el usuario NUEVO.
// Reutiliza FavoritesOnboarding (elegir equipos favoritos). Reglas:
//  • Aparece UNA sola vez (clave `ts_onboarded`), nunca a quien ya eligió equipos.
//  • Espera a que el aviso de cookies esté decidido (prioridad legal, no compite
//    con el banner) y a que la página haya cargado; abre tras un respiro para NO
//    afectar al LCP (el modal no entra en el render inicial).
//  • Totalmente saltable. Guarda en el navegador (mismas claves que el calendario)
//    y, si hay sesión, sincroniza con la cuenta vía el endpoint existente.
// 0 KB de librerías, sin tocar la base de datos.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import FavoritesOnboarding from '@/components/FavoritesOnboarding'

const ONBOARDED_KEY = 'ts_onboarded'
const FAV_KEY = 'ts_favorites'
const CONSENT_KEY = 'taka-consent-v1'

export default function WelcomeOnboarding() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Solo usuarios nuevos: nunca si ya pasó por aquí o ya tiene favoritos.
    let alreadyDone = false
    try {
      if (localStorage.getItem(ONBOARDED_KEY) === '1') alreadyDone = true
      const favs = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]')
      if (Array.isArray(favs) && favs.length > 0) alreadyDone = true
    } catch {
      alreadyDone = true // si localStorage falla, mejor no molestar
    }
    if (alreadyDone) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let poll: ReturnType<typeof setInterval> | undefined

    const consentDecided = () => {
      try { return localStorage.getItem(CONSENT_KEY) != null } catch { return true }
    }
    // Respiro de ~1,2 s para que la portada se asiente antes de abrir (el modal
    // nunca entra en el render inicial → el LCP no se toca). Para un usuario
    // nuevo, el aviso de cookies se decide bastante después de cargar, así que
    // este retardo es de sobra.
    const scheduleReveal = () => {
      timer = setTimeout(() => { if (!cancelled) setOpen(true) }, 1200)
    }

    if (consentDecided()) {
      scheduleReveal()
    } else {
      // Aún sin decidir las cookies: esperamos a que el usuario las resuelva.
      poll = setInterval(() => {
        if (consentDecided()) {
          if (poll) { clearInterval(poll); poll = undefined }
          if (!cancelled) scheduleReveal()
        }
      }, 1000)
    }

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (poll) clearInterval(poll)
    }
  }, [])

  const markDone = () => {
    try { localStorage.setItem(ONBOARDED_KEY, '1') } catch { /* ignore */ }
  }

  const handleSave = (teams: string[]) => {
    // Navegador: une lo elegido con lo que ya hubiera (no pisa nada).
    try {
      const existing = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]')
      const prev: string[] = Array.isArray(existing) ? existing : []
      const merged = Array.from(new Set([...prev, ...teams]))
      localStorage.setItem(FAV_KEY, JSON.stringify(merged))
    } catch { /* ignore */ }
    markDone()
    // Cuenta (best-effort, solo con sesión): mismo endpoint que el calendario.
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return
      for (const t of teams) {
        fetch('/api/rankings/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry_id: `team:${t}` }),
        }).catch(() => { /* best-effort */ })
      }
    }).catch(() => { /* ignore */ })
  }

  const handleClose = () => {
    markDone()
    setOpen(false)
  }

  if (!open) return null
  return (
    <FavoritesOnboarding
      onClose={handleClose}
      onSave={handleSave}
    />
  )
}
