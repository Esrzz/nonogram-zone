import { describe, expect, it } from 'vitest'
import { decodeSeed, encodeSeed, seedToPuzzle } from './seed'
import { generatePuzzle, mulberry32 } from './generator'

describe('semillas', () => {
  it('ida y vuelta con puzzles generados', () => {
    for (const size of [5, 10, 15, 25]) {
      const p = generatePuzzle(size, mulberry32(size))
      const seed = encodeSeed(p.solution, size)
      expect(seed.startsWith(`NZ1-${size}-`)).toBe(true)
      const back = decodeSeed(seed)!
      expect(back.size).toBe(size)
      expect([...back.cells]).toEqual([...p.solution])
      expect(seedToPuzzle(seed).rows).toEqual(p.rows)
    }
  })
  it('tolera espacios al pegar y rechaza lo inválido', () => {
    const seed = encodeSeed([1, 0, 0, 1], 2)
    expect(decodeSeed(`  ${seed.slice(0, 5)}\n${seed.slice(5)} `)).not.toBeNull()
    for (const bad of ['', 'hola', 'NZ1-5-', 'NZ1-1-AA', 'NZ2-5-AAAA', 'NZ1-5-AAAA', encodeSeed([0, 0, 0, 0], 2)]) expect(decodeSeed(bad)).toBeNull()
  })
})
