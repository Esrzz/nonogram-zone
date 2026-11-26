import { describe, expect, it } from 'vitest'
import { generatePuzzle, mulberry32 } from './generator'
import { gridClues, solve } from './nonogram'

describe('generatePuzzle', () => {
  for (const size of [5, 10, 15]) {
    it(`${size}x${size}: solución única, resoluble por lógica y con pintado razonable`, () => {
      const rnd = mulberry32(1000 + size)
      for (let i = 0; i < 6; i++) {
        const p = generatePuzzle(size, rnd)
        const r = solve(p.rows, p.cols)
        expect(r.count).toBe(1)
        expect([...r.solutions[0]]).toEqual([...p.solution])
        expect(gridClues(p.solution, size, size)).toEqual({ rows: p.rows, cols: p.cols })
        const pct = p.solution.reduce((a, b) => a + b, 0) / (size * size)
        expect(pct).toBeGreaterThan(0.3)
        expect(pct).toBeLessThan(0.8)
        expect(p.logic).toBe(true)
      }
    })
  }
  it('misma semilla, mismo puzzle (para el diario)', () => {
    const a = generatePuzzle(10, mulberry32(20261126))
    const b = generatePuzzle(10, mulberry32(20261126))
    expect([...a.solution]).toEqual([...b.solution])
  })
})
