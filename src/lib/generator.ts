import { gridClues, logicSolve, solve } from './nonogram'
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
export function blobImage(n: number, p: number, rnd: () => number, smooth = 2): Uint8Array {
  let f = Float32Array.from({ length: n * n }, () => rnd())
  for (let it = 0; it < smooth; it++) {
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

/**
 * Arregla una imagen ambigua para que sea de solución única Y resoluble por lógica: invierte celdas que la lógica por
 * líneas no logra decidir, de a varias por ronda, hasta que no quede ninguna. Modifica `img`. false = no convergió.
 */
export function repairToLogic(img: Uint8Array, size: number, rnd: () => number, maxRounds = 250): boolean {
  for (let round = 0; round < maxRounds; round++) {
    const { rows, cols } = gridClues(img, size, size)
    const st = logicSolve(rows, cols)
    if (!st) return false
    const unknown: number[] = []
    for (let i = 0; i < st.length; i++) if (st[i] === -1) unknown.push(i)
    if (unknown.length === 0) return true
    const flips = Math.max(1, Math.ceil(unknown.length / 25))
    for (let k = 0; k < flips; k++) img[unknown[Math.floor(rnd() * unknown.length)]] ^= 1
  }
  return false
}

/**
 * Rango de pintado (0–1) con el que conviene generar según el tamaño. En tableros grandes hace falta MÁS pintado:
 * con poco, las filas tienen tanto margen que la lógica no puede deducir nada (ver scripts/density.ts).
 */
export function densityRange(size: number): [number, number] {
  if (size <= 15) return [0.45, 0.62]
  if (size <= 25) return [0.55, 0.72]
  return [0.66, 0.76]
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
  /** Rango de % pintado (0–1). Por defecto, según el tamaño (ver densityRange) */
  minDensity?: number
  maxDensity?: number
  maxTries?: number
}

/**
 * Genera un puzzle de solución ÚNICA. Parte de una imagen con formas, calcula las pistas y las verifica con el solver;
 * descarta las ambiguas. Prefiere los que se resuelven por pura lógica (para un puzzle justo).
 */
export function generatePuzzle(size: number, rnd: () => number = Math.random, opts: GenOptions = {}): Puzzle {
  const [dlo, dhi] = densityRange(size)
  const lo = opts.minDensity ?? dlo
  const hi = opts.maxDensity ?? dhi

  // Tableros de 20 o más: imagen con formas + reparación (garantiza única y resoluble por lógica)
  if (size >= 20) {
    const smooth = size > 25 ? 3 : 2
    for (let t = 0; t < (opts.maxTries ?? 12); t++) {
      const solution = blobImage(size, lo + rnd() * (hi - lo), rnd, smooth)
      if (!repairToLogic(solution, size, rnd)) continue
      const { rows, cols } = gridClues(solution, size, size)
      return { size, solution, rows, cols, logic: true }
    }
    throw new Error(`No se pudo generar un puzzle de ${size}×${size}`)
  }

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

// ---- Ediciones fijas: todos los jugadores obtienen el MISMO puzzle a partir de la semilla ----
// ¡No cambiar blobImage / repairToLogic / densityRange sin versionar: cambiaría los puzzles ya publicados!

export const MONTHLY_SIZE = 50
export const WORLD_RACE_SIZE = 150
export const WORLD_RACE_EDITION = 1

/** Mensual 50×50: un puzzle por mes (mes 1–12). */
export function monthlyPuzzle(year: number, month: number): Puzzle {
  return generatePuzzle(MONTHLY_SIZE, mulberry32(year * 100 + month + 0x4d4f4e))
}

/** Carrera mundial 150×150: un puzzle por edición. */
export function worldRacePuzzle(edition = WORLD_RACE_EDITION): Puzzle {
  return generatePuzzle(WORLD_RACE_SIZE, mulberry32(0x57524c + edition))
}
