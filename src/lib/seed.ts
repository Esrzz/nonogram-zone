import { gridClues, logicSolve, solve } from './nonogram'
import type { Puzzle } from './generator'

/**
 * Semilla de un nonograma: un texto corto que contiene la imagen solución, para compartirlo y que otros lo resuelvan.
 * Formato: `NZ1-<tamaño>-<celdas>`; las celdas van en bits (fila por fila), en base64 seguro para direcciones.
 */
export const SEED_MAX_SIZE = 150
const PREFIX = 'NZ1'

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const fromB64 = (s: string) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))

export function encodeSeed(cells: ArrayLike<number>, size: number): string {
  const bytes = new Uint8Array(Math.ceil((size * size) / 8))
  for (let i = 0; i < size * size; i++) if (cells[i] === 1) bytes[i >> 3] |= 0x80 >> (i & 7)
  return `${PREFIX}-${size}-${toB64(bytes)}`
}

/** Imagen (0/1) y tamaño de una semilla, o null si no es válida. Tolera espacios y saltos de línea al pegar. */
export function decodeSeed(raw: string): { size: number; cells: Uint8Array } | null {
  const m = /^NZ1-(\d{1,3})-([A-Za-z0-9_-]+)$/.exec(raw.replace(/\s+/g, ''))
  if (!m) return null
  const size = Number(m[1])
  if (size < 2 || size > SEED_MAX_SIZE) return null
  let bytes: Uint8Array
  try {
    bytes = fromB64(m[2])
  } catch {
    return null
  }
  if (bytes.length !== Math.ceil((size * size) / 8)) return null
  const cells = new Uint8Array(size * size)
  for (let i = 0; i < cells.length; i++) cells[i] = (bytes[i >> 3] >> (7 - (i & 7))) & 1
  return cells.includes(1) ? { size, cells } : null
}

/** Puzzle a partir de una semilla (lanza error si no es válida). */
export function seedToPuzzle(seed: string): Puzzle {
  const d = decodeSeed(seed)
  if (!d) throw new Error('Semilla inválida')
  const { rows, cols } = gridClues(d.cells, d.size, d.size)
  const logic = d.size <= 25 ? (() => { const r = solve(rows, cols, { maxNodes: 5000 }); return !r.aborted && r.count === 1 && r.logicOnly })() : !logicSolve(rows, cols)?.includes(-1)
  return { size: d.size, solution: d.cells, rows, cols, logic }
}
