import { describe, expect, it } from 'vitest'
import { createRng } from './rng'

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(
      Array.from({ length: 5 }, () => b.next()),
    )
  })

  it('differs between seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })

  it('produces floats in [0, 1) and ints in [0, n)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const f = rng.next()
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
      const n = rng.int(6)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(6)
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('rejects invalid int bounds and empty picks', () => {
    const rng = createRng(1)
    expect(() => rng.int(0)).toThrow(RangeError)
    expect(() => rng.int(1.5)).toThrow(RangeError)
    expect(() => rng.pick([])).toThrow(RangeError)
  })

  it('shuffle keeps every element and does not mutate the input', () => {
    const rng = createRng(3)
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = rng.shuffle(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...out].sort((a, b) => a - b)).toEqual(input)
  })
})
