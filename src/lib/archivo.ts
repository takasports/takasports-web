// Lógica pura compartida por el server component de /archivo y el cliente.
// No marcar como 'use client' — debe ser importable desde el servidor.

export type DateRangePreset = 'todo' | '7d' | '30d' | '3m' | 'ano' | 'custom'

export const VALID_PRESETS: DateRangePreset[] = ['todo', '7d', '30d', '3m', 'ano', 'custom']

export function presetToRange(
  preset: DateRangePreset,
  custom?: { from: string; to: string },
): { from?: string; to?: string } {
  if (preset === 'todo') return {}
  if (preset === 'custom') {
    return { from: custom?.from || undefined, to: custom?.to || undefined }
  }
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const fromDate = new Date(now)
  if (preset === '7d') fromDate.setDate(fromDate.getDate() - 7)
  else if (preset === '30d') fromDate.setDate(fromDate.getDate() - 30)
  else if (preset === '3m') fromDate.setMonth(fromDate.getMonth() - 3)
  else if (preset === 'ano') fromDate.setFullYear(fromDate.getFullYear() - 1)
  return { from: fromDate.toISOString().slice(0, 10), to }
}
