import { describe, expect, it } from 'vitest'
import { generatePuzzle, monthlyPuzzle, mulberry32, worldRacePuzzle } from './generator'
import { gridClues, logicSolve, solve } from './nonogram'

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
  for (const size of [20, 25]) {
    it(`${size}x${size}: única y resoluble por lógica`, () => {
      const rnd = mulberry32(77 + size)
      for (let i = 0; i < 4; i++) {
        const p = generatePuzzle(size, rnd)
        const r = solve(p.rows, p.cols)
        expect(r.count).toBe(1)
        expect(r.logicOnly).toBe(true)
        expect([...r.solutions[0]]).toEqual([...p.solution])
      }
    })
  }
  it('mensual 50x50: único por lógica, estable por mes y distinto entre meses', () => {
    const a = monthlyPuzzle(2026, 11)
    expect(logicSolve(a.rows, a.cols)!.includes(-1)).toBe(false)
    expect([...monthlyPuzzle(2026, 11).solution]).toEqual([...a.solution])
    expect([...monthlyPuzzle(2026, 12).solution]).not.toEqual([...a.solution])
    const pct = a.solution.reduce((x, y) => x + y, 0) / a.solution.length
    expect(pct).toBeGreaterThan(0.6)
    expect(pct).toBeLessThan(0.8)
  })
  it('carrera mundial 150x150: única por lógica y en tiempo razonable', () => {
    const t0 = performance.now()
    const p = worldRacePuzzle()
    expect(performance.now() - t0).toBeLessThan(15000)
    const st = logicSolve(p.rows, p.cols)!
    expect(st.includes(-1)).toBe(false)
    expect([...st]).toEqual([...p.solution])
    expect(Math.max(...p.rows.map((r) => r.length), ...p.cols.map((c) => c.length))).toBeLessThan(40)
  }, 30000)
  it('misma semilla, mismo puzzle (para el diario)', () => {
    const a = generatePuzzle(10, mulberry32(20261126))
    const b = generatePuzzle(10, mulberry32(20261126))
    expect([...a.solution]).toEqual([...b.solution])
  })
})
