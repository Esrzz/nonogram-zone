import { gridClues, solve } from './nonogram'
import type { Clue } from './nonogram'

/** Generador de números aleatorios con semilla (mismo seed = misma secuencia): sirve para el puzzle del día. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Imagen "con formas": ruido suavizado por vecinos y recortado al % pedido (0–1) de celdas pintadas. */
export function blobImage(n: number, p: number, rnd: () => number): Uint8Array {
  let f = Float32Array.from({ length: n * n }, () => rnd())
  for (let it = 0; it < 2; it++) {
    const g = new Float32Array(n * n)
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let s = 0
        let c = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy
            const xx = x + dx
            if (yy >= 0 && yy < n && xx >= 0 && xx < n) { s += f[yy * n + xx]; c++ }
          }
        }
        g[y * n + x] = s / c
      }
    }
    f = g
  }
  const order = Array.from(f.keys()).sort((a, b) => f[a] - f[b])
  const out = new Uint8Array(n * n)
  for (let i = 0; i < Math.round(p * n * n); i++) out[order[i]] = 1
  return out
}

export interface Puzzle {
  size: number
  /** Imagen solución (0/1, fila por fila) */
  solution: Uint8Array
  rows: Clue[]
  cols: Clue[]
  /** Se resuelve solo con lógica, sin probar y descartar */
  logic: boolean
}

export interface GenOptions {
  /** Rango de % pintado (0–1). Por defecto 0.45–0.62 (ver scripts/density.ts) */
  minDensity?: number
  maxDensity?: number
  maxTries?: number
}

/**
 * Genera un puzzle de solución ÚNICA. Parte de una imagen con formas, calcula las pistas y las verifica con el solver;
 * descarta las ambiguas. Prefiere los que se resuelven por pura lógica (para un puzzle justo).
 */
export function generatePuzzle(size: number, rnd: () => number = Math.random, opts: GenOptions = {}): Puzzle {
  const lo = opts.minDensity ?? 0.45
  const hi = opts.maxDensity ?? 0.62
  const maxTries = opts.maxTries ?? 400
  let fallback: Puzzle | null = null
  for (let t = 0; t < maxTries; t++) {
    const solution = blobImage(size, lo + rnd() * (hi - lo), rnd)
    const { rows, cols } = gridClues(solution, size, size)
    const r = solve(rows, cols, { maxNodes: 1500 })
    if (r.aborted || r.count !== 1) continue
    const puzzle: Puzzle = { size, solution, rows, cols, logic: r.logicOnly }
    if (r.logicOnly) return puzzle
    fallback ??= puzzle
  }
  if (fallback) return fallback
  // Último recurso (no debería pasar): subir la densidad hasta que haya solución única
  for (let p = hi; p <= 0.9; p += 0.05) {
    const solution = blobImage(size, p, rnd)
    const { rows, cols } = gridClues(solution, size, size)
    const r = solve(rows, cols, { maxNodes: 5000 })
    if (!r.aborted && r.count === 1) return { size, solution, rows, cols, logic: r.logicOnly }
  }
  throw new Error('No se pudo generar un puzzle de solución única')
}
