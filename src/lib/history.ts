import { loadJson, saveJson } from './storage'

export type HistoryKind = 'random' | 'saved' | 'monthly' | 'world'

/** Un nonograma resuelto, anotado en el perfil. */
export interface HistoryEntry {
  id: string
  /** Nombre a mostrar: "Aleatorio", el nombre del guardado, "Mensual · noviembre 2026"… */
  label: string
  size: number
  kind: HistoryKind
  /** Tiempo que tardó, en milisegundos */
  ms: number
  /** Cuándo lo resolvió */
  at: number
}

export const MAX_HISTORY = 300
const KINDS: HistoryKind[] = ['random', 'saved', 'monthly', 'world']
const storageKey = (key: string) => `nz-history:${key}`

export function loadHistory(key: string): HistoryEntry[] {
  const data = loadJson(storageKey(key))
  if (!Array.isArray(data)) return []
  return data.filter(
    (d): d is HistoryEntry =>
      d && typeof d.id === 'string' && typeof d.label === 'string' && KINDS.includes(d.kind) &&
      Number.isInteger(d.size) && d.size >= 2 && d.size <= 200 &&
      Number.isFinite(d.ms) && d.ms >= 0 && Number.isFinite(d.at),
  )
}

export const persistHistory = (key: string, list: HistoryEntry[]): boolean => saveJson(storageKey(key), list.slice(0, MAX_HISTORY))

/** Mejor tiempo por tamaño (solo cuenta los que tienen tiempo medido). */
export function bestBySize(list: HistoryEntry[]): { size: number; ms: number; count: number }[] {
  const m = new Map<number, { size: number; ms: number; count: number }>()
  for (const e of list) {
    const cur = m.get(e.size) ?? { size: e.size, ms: Infinity, count: 0 }
    cur.count++
    if (e.ms > 0) cur.ms = Math.min(cur.ms, e.ms)
    m.set(e.size, cur)
  }
  return [...m.values()].sort((a, b) => a.size - b.size)
}
