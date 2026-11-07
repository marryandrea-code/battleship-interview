import { checkPlacement, placeShip, randomFleet } from '../board'
import {
  BOARD_SIZE,
  FLEET,
  coordKey,
  type Coord,
  type PlacedShip,
  type PublicBoardView,
  type ShipPlacement,
} from '../types'
import type { Rng } from '../rng'
import { bestCells, densityMap, jointDensity, neighbors, unknownCells } from './analysis'
import { huntTargetShot, targetCandidates } from './huntTarget'
import type { AiStrategy } from './types'

/** Level 1: fires at random, never remembers a hit. */
export const ensign: AiStrategy = {
  rank: 'ensign',
  placeFleet: randomFleet,
  chooseShot(view, rng) {
    return rng.pick(unknownCells(view))
  },
}

/** Level 2: parity hunting, then follows up hits along a line. */
export const lieutenant: AiStrategy = {
  rank: 'lieutenant',
  placeFleet: randomFleet,
  chooseShot: huntTargetShot,
}

/**
 * Level 3: hunts with a placement-density heatmap (how many ways the
 * remaining ships could cover each cell), but finishes wounded ships with the
 * simpler line-following tactic.
 */
export const commander: AiStrategy = {
  rank: 'commander',
  placeFleet: randomFleet,
  chooseShot(view, rng) {
    const targets = targetCandidates(view)
    if (targets.length > 0) return rng.pick(targets)
    const density = densityMap(view, { hitWeight: 1, requireHit: false })
    return rng.pick(bestCells(density, view))
  },
}

/** Maximum joint arrangements the Admiral will enumerate exactly per shot. */
export const ADMIRAL_SEARCH_BUDGET = 100_000

/**
 * Level 4: exact inference when it is affordable. Enumerates every joint
 * arrangement of the remaining ships consistent with all hits and misses and
 * fires at the cell occupied in the most of them; early in the game, when the
 * search is too large, it falls back to the per-ship heatmap with wounded
 * cells weighted heavily. Also spreads its own fleet out so a hit on one ship
 * never leads to another.
 */
export const admiral: AiStrategy = {
  rank: 'admiral',
  placeFleet: spreadFleet,
  chooseShot(view, rng) {
    const density =
      jointDensity(view, ADMIRAL_SEARCH_BUDGET) ??
      densityMap(view, { hitWeight: 10, requireHit: false })
    return rng.pick(bestCells(density, view))
  },
}

/** Random fleet where no two ships touch, even diagonally. Falls back to random if boxed in. */
export function spreadFleet(rng: Rng): ShipPlacement[] {
  const ships: PlacedShip[] = []
  const placements: ShipPlacement[] = []
  const forbidden = new Set<string>()
  for (const spec of FLEET) {
    const options: ShipPlacement[] = []
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (const orientation of ['horizontal', 'vertical'] as const) {
          const candidate: ShipPlacement = { kind: spec.kind, bow: { row, col }, orientation }
          if (!checkPlacement(ships, candidate).ok) continue
          const placed = placeShip(candidate)
          if (placed.cells.some((c) => forbidden.has(coordKey(c)))) continue
          options.push(candidate)
        }
      }
    }
    if (options.length === 0) return randomFleet(rng)
    const chosen = rng.pick(options)
    const placed = placeShip(chosen)
    placements.push(chosen)
    ships.push(placed)
    for (const c of placed.cells) {
      forbidden.add(coordKey(c))
      for (const n of neighborsWithDiagonals(c)) forbidden.add(coordKey(n))
    }
  }
  return placements
}

function neighborsWithDiagonals(c: Coord): Coord[] {
  const out = neighbors(c)
  for (const dr of [-1, 1]) {
    for (const dc of [-1, 1]) {
      const d = { row: c.row + dr, col: c.col + dc }
      if (d.row >= 0 && d.row < BOARD_SIZE && d.col >= 0 && d.col < BOARD_SIZE) out.push(d)
    }
  }
  return out
}

export function isLegalShot(view: PublicBoardView, coord: Coord): boolean {
  return unknownCells(view).some((c) => c.row === coord.row && c.col === coord.col)
}
