import { shipCells } from '../board'
import {
  BOARD_SIZE,
  coordKey,
  fromIndex,
  isInBounds,
  toIndex,
  type Coord,
  type PublicBoardView,
} from '../types'

export function unknownCells(view: PublicBoardView): Coord[] {
  const cells: Coord[] = []
  view.shots.forEach((state, i) => {
    if (state === 'unknown') cells.push(fromIndex(i))
  })
  return cells
}

/** Hits that do not belong to an already sunk ship, i.e. ships still afloat. */
export function activeHits(view: PublicBoardView): Coord[] {
  const sunkKeys = new Set(view.sunk.flatMap((s) => s.cells.map(coordKey)))
  const hits: Coord[] = []
  view.shots.forEach((state, i) => {
    const c = fromIndex(i)
    if (state === 'hit' && !sunkKeys.has(coordKey(c))) hits.push(c)
  })
  return hits
}

export function neighbors({ row, col }: Coord): Coord[] {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ].filter(isInBounds)
}

export interface DensityOptions {
  /**
   * Extra weight multiplier applied per active hit a placement covers.
   * 1 ignores hits (pure hunting); higher values focus fire around wounded ships.
   */
  readonly hitWeight: number
  /** When true and there are active hits, only placements covering a hit count. */
  readonly requireHit: boolean
}

/**
 * For every unknown cell, count the ways the remaining ships could still be
 * lying across it given the shots so far. Cells belonging to sunk ships and
 * misses block placements; active hits are cells a ship must pass through.
 */
export function densityMap(view: PublicBoardView, options: DensityOptions): number[] {
  const density = new Array<number>(BOARD_SIZE * BOARD_SIZE).fill(0)
  const sunkKeys = new Set(view.sunk.flatMap((s) => s.cells.map(coordKey)))
  const hits = activeHits(view)
  const hitKeys = new Set(hits.map(coordKey))
  const targeting = options.requireHit && hits.length > 0

  const blocked = (c: Coord): boolean =>
    view.shots[toIndex(c)] === 'miss' || sunkKeys.has(coordKey(c))

  for (const ship of view.remaining) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (const orientation of ['horizontal', 'vertical'] as const) {
          const cells = shipCells({ row, col }, ship.length, orientation)
          const last = cells[cells.length - 1]
          if (!last || !isInBounds(last)) continue
          if (cells.some(blocked)) continue
          const covered = cells.filter((c) => hitKeys.has(coordKey(c))).length
          if (targeting && covered === 0) continue
          const weight = Math.pow(options.hitWeight, covered)
          for (const c of cells) {
            if (view.shots[toIndex(c)] === 'unknown') density[toIndex(c)]! += weight
          }
        }
      }
    }
  }
  return density
}

export function bestCells(density: readonly number[], view: PublicBoardView): Coord[] {
  let best = -Infinity
  let cells: Coord[] = []
  density.forEach((value, i) => {
    if (view.shots[i] !== 'unknown') return
    if (value > best) {
      best = value
      cells = [fromIndex(i)]
    } else if (value === best) {
      cells.push(fromIndex(i))
    }
  })
  return cells
}

/**
 * Exact posterior: enumerate every joint arrangement of the remaining ships
 * that is consistent with all shots (no overlap, no misses, every active hit
 * covered) and count how often each unknown cell is occupied. Returns null when
 * the search space exceeds `budget` leaves so callers can fall back to the
 * per-ship approximation in `densityMap`.
 */
export function jointDensity(view: PublicBoardView, budget: number): number[] | null {
  const sunkKeys = new Set(view.sunk.flatMap((s) => s.cells.map(coordKey)))
  const hits = activeHits(view)
  const hitIndexes = hits.map(toIndex)
  const blocked = (c: Coord): boolean =>
    view.shots[toIndex(c)] === 'miss' || sunkKeys.has(coordKey(c))

  const perShip: number[][][] = []
  let leaves = 1
  for (const ship of view.remaining) {
    const options: number[][] = []
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (const orientation of ['horizontal', 'vertical'] as const) {
          const cells = shipCells({ row, col }, ship.length, orientation)
          const last = cells[cells.length - 1]
          if (!last || !isInBounds(last) || cells.some(blocked)) continue
          options.push(cells.map(toIndex))
        }
      }
    }
    if (options.length === 0) return null
    perShip.push(options)
    leaves *= options.length
    if (leaves > budget) return null
  }
  perShip.sort((a, b) => a.length - b.length)

  const density = new Array<number>(BOARD_SIZE * BOARD_SIZE).fill(0)
  const occupied = new Uint8Array(BOARD_SIZE * BOARD_SIZE)
  const chosen: number[][] = []
  let configurations = 0

  const recurse = (depth: number): void => {
    if (depth === perShip.length) {
      if (hitIndexes.some((i) => occupied[i] === 0)) return
      configurations++
      for (const cells of chosen) for (const i of cells) density[i]! += 1
      return
    }
    for (const cells of perShip[depth]!) {
      if (cells.some((i) => occupied[i] === 1)) continue
      for (const i of cells) occupied[i] = 1
      chosen.push(cells)
      recurse(depth + 1)
      chosen.pop()
      for (const i of cells) occupied[i] = 0
    }
  }
  recurse(0)
  if (configurations === 0) return null
  for (let i = 0; i < density.length; i++) {
    if (view.shots[i] !== 'unknown') density[i] = 0
  }
  return density
}
