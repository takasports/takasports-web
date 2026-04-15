// Datos centralizados de eventos — se reemplazará con Sanity schema cuando esté listo
// SportEvent vive en /lib/types.ts como fuente única de verdad
import type { SportEvent } from './types'

export type { SportEvent }

export const ALL_EVENTS: SportEvent[] = [
  { id: '1',  home: 'Real Madrid',    away: 'Atlético',   sport: 'Fútbol', comp: 'LaLiga',          date: 'Hoy',    time: '21:00', accent: '#22c55e' },
  { id: '2',  home: 'Lakers',         away: 'Celtics',    sport: 'NBA',    comp: 'NBA Playoffs',    date: 'Mañana', time: '02:30', accent: '#f59e0b' },
  { id: '3',  home: 'GP Japón',       away: null,         sport: 'F1',     comp: 'Fórmula 1',       date: 'Dom',    time: '07:00', accent: '#ef4444' },
  { id: '4',  home: 'Djokovic',       away: 'Alcaraz',    sport: 'Tenis',  comp: 'Roland Garros',   date: 'Sáb',    time: '14:00', accent: '#a78bfa' },
  { id: '5',  home: 'Argentina',      away: 'Brasil',     sport: 'Fútbol', comp: 'Eliminatorias',   date: 'Mar',    time: '20:30', accent: '#22c55e' },
  { id: '6',  home: 'Warriors',       away: 'Knicks',     sport: 'NBA',    comp: 'NBA Playoffs',    date: 'Mié',    time: '01:00', accent: '#f59e0b' },
  { id: '7',  home: 'Sinner',         away: 'Zverev',     sport: 'Tenis',  comp: 'Roland Garros',   date: 'Jue',    time: '13:00', accent: '#a78bfa' },
  { id: '8',  home: 'Barcelona',      away: 'Valencia',   sport: 'Fútbol', comp: 'LaLiga',          date: 'Sáb',    time: '18:30', accent: '#22c55e' },
  { id: '9',  home: 'UFC Fight Night', away: null,        sport: 'UFC',    comp: 'UFC Fight Night', date: 'Sáb',    time: '23:00', accent: '#ef4444' },
  { id: '10', home: 'GP Mónaco',      away: null,         sport: 'F1',     comp: 'Fórmula 1',       date: 'Próx',   time: '15:00', accent: '#ef4444' },
]

// Versión home: primeros 4 eventos
export const HOME_EVENTS = ALL_EVENTS.slice(0, 4)
