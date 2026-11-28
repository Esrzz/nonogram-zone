import { describe, expect, it } from 'vitest'
import { lockStep, newLock } from './strokeLock'
import { mulberry32 } from './generator'

const size = 12

describe('trazo bloqueado', () => {
  it('sigue la fila aunque el mouse se desvíe en diagonal', () => {
    const lk = newLock(3 * size + 3, size)
    expect(lockStep(lk, 3 * size + 4, size)).toEqual([39, 40])
    expect(lockStep(lk, 5 * size + 6, size)).toEqual([40, 41, 42]) // r=5 pero el eje es horizontal → fila 3
    expect(lk.last).toBe(3 * size + 6)
  })

  it('rellena las celdas saltadas', () => {
    const lk = newLock(0, size)
    expect(lockStep(lk, 4 * size, size)).toEqual([0, 12, 24, 36, 48])
  })

  it('recorridos al azar (círculos, zigzag): todo lo pintado queda en una sola línea por trazo', () => {
    const rnd = mulberry32(5)
    for (let t = 0; t < 300; t++) {
      const start = Math.floor(rnd() * size * size)
      const lk = newLock(start, size)
      const painted = new Set<number>([start])
      let r = Math.floor(start / size)
      let c = start % size
      for (let k = 0; k < 120; k++) {
        r = Math.min(size - 1, Math.max(0, r + Math.round((rnd() - 0.5) * 4)))
        c = Math.min(size - 1, Math.max(0, c + Math.round((rnd() - 0.5) * 4)))
        for (const j of lockStep(lk, r * size + c, size)) {
          expect(j).toBeGreaterThanOrEqual(0)
          expect(j).toBeLessThan(size * size)
          painted.add(j)
        }
      }
      // con el eje fijo todo el trazo cae en una sola fila o columna
      const rowsUsed = new Set([...painted].map((j) => Math.floor(j / size)))
      const colsUsed = new Set([...painted].map((j) => j % size))
      expect(rowsUsed.size === 1 || colsUsed.size === 1).toBe(true)
    }
  })
})
