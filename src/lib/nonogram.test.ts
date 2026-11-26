import { describe, expect, it } from 'vitest'
import { gridClues, lineClue, solve, solveLine } from './nonogram'

const g = (rows: string[]) => Uint8Array.from(rows.join('').split('').map((c) => (c === '#' ? 1 : 0)))

describe('lineClue / gridClues', () => {
  it('cuenta bloques', () => {
    expect(lineClue([1, 1, 0, 1, 0, 0, 1, 1, 1])).toEqual([2, 1, 3])
    expect(lineClue([0, 0, 0])).toEqual([])
  })
  it('arma pistas de filas y columnas', () => {
    const { rows, cols } = gridClues(g(['#.#', '###', '...']), 3, 3)
    expect(rows).toEqual([[1, 1], [3], []])
    expect(cols).toEqual([[2], [1], [2]])
  })
})

describe('solveLine', () => {
  it('deduce el solapamiento', () => {
    expect([...solveLine([4], new Int8Array(5).fill(-1))!]).toEqual([-1, 1, 1, 1, -1])
  })
  it('línea completa', () => {
    expect([...solveLine([2, 1], new Int8Array(4).fill(-1))!]).toEqual([1, 1, 0, 1])
  })
  it('respeta lo ya conocido y detecta imposibles', () => {
    expect([...solveLine([2], Int8Array.from([-1, -1, 0, -1, -1]))!]).toEqual([-1, -1, 0, -1, -1])
    expect(solveLine([3], Int8Array.from([0, -1, -1, 0]))).toBeNull()
  })
})

describe('solve', () => {
  it('solución única por lógica', () => {
    const pic = g(['#.#', '###', '#.#'])
    const { rows, cols } = gridClues(pic, 3, 3)
    const r = solve(rows, cols)
    expect(r.count).toBe(1)
    expect(r.logicOnly).toBe(true)
    expect([...r.solutions[0]]).toEqual([...pic])
  })
  it('detecta ambigüedad (tablero de ajedrez 2x2)', () => {
    const r = solve([[1], [1]], [[1], [1]])
    expect(r.count).toBe(2)
    expect(r.solutions).toHaveLength(2)
  })
  it('sin solución si las sumas no cierran', () => {
    expect(solve([[2], [1]], [[1], [1]]).count).toBe(0)
  })
  it('sin solución con sumas iguales pero imposible', () => {
    expect(solve([[2], [2]], [[1], [1], [2]]).count).toBe(0)
  })
  it('propiedad: toda imagen aleatoria tiene solución y, si es única, es ella misma', () => {
    let seed = 12345
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
    for (let t = 0; t < 150; t++) {
      const n = 4 + Math.floor(rnd() * 8)
      const pic = Uint8Array.from({ length: n * n }, () => (rnd() < 0.55 ? 1 : 0))
      const { rows, cols } = gridClues(pic, n, n)
      const r = solve(rows, cols)
      expect(r.aborted).toBe(false)
      expect(r.count).toBeGreaterThan(0)
      if (r.count === 1) expect([...r.solutions[0]]).toEqual([...pic])
      else expect(r.solutions.some((s) => s.every((v, i) => v === pic[i])) || r.solutions.length === 2).toBe(true)
      // toda solución devuelta respeta las pistas
      for (const sol of r.solutions) expect(gridClues(sol, n, n)).toEqual({ rows, cols })
    }
  })
  it('tablero vacío: única solución vacía', () => {
    const r = solve([[], []], [[], []])
    expect(r.count).toBe(1)
    expect([...r.solutions[0]]).toEqual([0, 0, 0, 0])
  })
})
