'use client'

// WelcomeOnboarding — bienvenida para el usuario NUEVO.
// Desde el 04/09/2026 son TRES PASOS (deportes → equipos → hecho), como en la
// app: ver WelcomeSteps. Antes abría de golpe la rejilla de equipos
// (FavoritesOnboarding), que sigue viva para editar favoritos desde el
// calendario. Reglas:
//  • Aparece UNA sola vez (clave `ts_onboarded`), nunca a quien ya eligió equipos.
//  • Espera a que el aviso de cookies esté decidido (prioridad legal, no compite
//    con el banner) y a que la página haya cargado; abre tras un respiro para NO
//    afectar al LCP (el modal no entra en el render inicial).
//  • Totalmente saltable. Guarda en el navegador (mismas claves que el calendario)
//    y, si hay sesión, sincroniza con la cuenta vía el endpoint existente.
// 0 KB de librerías, sin tocar la base de datos.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import WelcomeSteps, { IR_A_TU_DIA } from '@/components/WelcomeSteps'

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

  // Vuelta de la bienvenida: el último paso recarga la portada para que lo
  // elegido se note. Aquí se recoge la bandera y se baja al bloque «Tu día», que
  // aparece en cuanto el navegador tiene deportes o equipos guardados. Se espera
  // un poco porque el bloque se pinta tras leer el almacén (y la nube, si hay
  // sesión); si a los 3 s no está, se abandona en silencio.
  useEffect(() => {
    let pendiente = false
    try {
      pendiente = sessionStorage.getItem(IR_A_TU_DIA) === '1'
      if (pendiente) sessionStorage.removeItem(IR_A_TU_DIA)
    } catch { return }
    if (!pendiente) return
    const t0 = Date.now()
    const id = setInterval(() => {
      const el = document.getElementById('tu-dia-titulo')
      if (el) {
        clearInterval(id)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (Date.now() - t0 > 3000) {
        clearInterval(id)
      }
    }, 200)
    return () => clearInterval(id)
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
    <WelcomeSteps
      onClose={handleClose}
      onSave={handleSave}
    />
  )
}
