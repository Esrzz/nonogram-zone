import { describe, expect, it } from 'vitest'
import { bestBySize } from './history'
import type { HistoryEntry } from './history'

const e = (size: number, ms: number): HistoryEntry => ({ id: `${size}-${ms}`, label: 'x', size, kind: 'random', ms, at: 0 })

describe('historial', () => {
  it('mejor tiempo y cantidad por tamaño', () => {
    const r = bestBySize([e(10, 90_000), e(5, 20_000), e(10, 60_000), e(10, 0)])
    expect(r).toEqual([
      { size: 5, ms: 20_000, count: 1 },
      { size: 10, ms: 60_000, count: 3 },
    ])
  })
})
