/**
 * Small seeded PRNG (mulberry32). Passed explicitly everywhere randomness is
 * needed so games are replayable and tests are deterministic.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [0, n). */
  int(n: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (n: number): number => {
    if (!Number.isInteger(n) || n <= 0) throw new RangeError(`int(n) requires n >= 1, got ${n}`)
    return Math.floor(next() * n)
  }
  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError('pick() requires a non-empty array')
    return items[int(items.length)] as T
  }
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1)
      const tmp = out[i] as T
      out[i] = out[j] as T
      out[j] = tmp
    }
    return out
  }
  return { next, int, pick, shuffle }
}

export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
}
