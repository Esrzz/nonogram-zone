import { loadJson, saveJson } from './storage'

export type HistoryKind = 'random' | 'saved' | 'monthly' | 'world' | 'coop'

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
const KINDS: HistoryKind[] = ['random', 'saved', 'monthly', 'world', 'coop']
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

/**
 * Carga el historial del perfil y le suma el que se guardó antes bajo otra clave (por ejemplo, cuando se jugó como invitado
 * con el mismo nombre y después se entró con Discord, el perfil pasa a tener otra clave y parecía vacío).
 */
export function loadHistoryMerged(key: string, legacyKeys: string[]): HistoryEntry[] {
  const main = loadHistory(key)
  const seen = new Set(main.map((e) => e.id))
  const all = [...main]
  for (const k of legacyKeys) {
    if (k === key) continue
    for (const e of loadHistory(k)) if (!seen.has(e.id)) (seen.add(e.id), all.push(e))
  }
  if (all.length === main.length) return main
  all.sort((a, b) => b.at - a.at)
  const out = all.slice(0, MAX_HISTORY)
  persistHistory(key, out)
  return out
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
