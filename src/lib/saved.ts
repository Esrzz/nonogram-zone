import { normalizeName } from './profile'

/** Un nonograma creado y guardado en el perfil. */
export interface SavedNonogram {
  id: string
  name: string
  size: number
  /** Imagen como texto de 0/1, fila por fila */
  cells: string
  /** Resultado de la verificación al guardar */
  unique: boolean
  logic: boolean
  createdAt: number
}

export const MAX_SAVED = 50

/** Clave del perfil: id de Discord si lo hay; si no, el nombre normalizado. Más adelante: la cuenta de Google. */
export const profileKey = (p: { id: string | null; name: string }): string => p.id ?? `n:${normalizeName(p.name)}`

const storageKey = (key: string) => `nz-saved:${key}`

export function loadSaved(key: string): SavedNonogram[] {
  try {
    const raw = localStorage.getItem(storageKey(key))
    const data = raw ? JSON.parse(raw) : []
    if (!Array.isArray(data)) return []
    return data.filter(
      (d): d is SavedNonogram =>
        d && typeof d.id === 'string' && typeof d.name === 'string' && typeof d.cells === 'string' &&
        Number.isInteger(d.size) && d.size >= 2 && d.size <= 40 && d.cells.length === d.size * d.size && /^[01]+$/.test(d.cells),
    )
  } catch {
    return []
  }
}

export function persistSaved(key: string, list: SavedNonogram[]): boolean {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(list.slice(0, MAX_SAVED)))
    return true
  } catch {
    return false
  }
}

export const cellsToString = (cells: ArrayLike<number>): string => Array.from(cells, (c) => (c === 1 ? '1' : '0')).join('')
export const stringToCells = (s: string): Uint8Array => Uint8Array.from(s.split('').map((c) => (c === '1' ? 1 : 0)))
