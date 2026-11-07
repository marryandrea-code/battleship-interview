import {
  BOARD_SIZE,
  FLEET,
  FLEET_BY_KIND,
  coordEquals,
  coordKey,
  isInBounds,
  toIndex,
  type Board,
  type CellState,
  type Coord,
  type Orientation,
  type PlacedShip,
  type PublicBoardView,
  type ShipKind,
  type ShipPlacement,
  type ShotResult,
  type SunkShip,
} from './types'
import type { Rng } from './rng'

export type PlacementProblem = 'unknown-ship' | 'out-of-bounds' | 'overlap' | 'duplicate'

export type PlacementCheck = { ok: true } | { ok: false; problem: PlacementProblem }

export function shipCells(bow: Coord, length: number, orientation: Orientation): Coord[] {
  const cells: Coord[] = []
  for (let i = 0; i < length; i++) {
    cells.push(
      orientation === 'horizontal'
        ? { row: bow.row, col: bow.col + i }
        : { row: bow.row + i, col: bow.col },
    )
  }
  return cells
}

export function placeShip(placement: ShipPlacement): PlacedShip {
  const spec = FLEET_BY_KIND[placement.kind]
  return { ...placement, cells: shipCells(placement.bow, spec.length, placement.orientation) }
}

/**
 * Check whether `placement` can be added next to `existing`. A ship of the
 * same kind already on the board is a duplicate unless it is the one being
 * moved (pass it in `ignoreKind`).
 */
export function checkPlacement(
  existing: readonly PlacedShip[],
  placement: ShipPlacement,
  ignoreKind?: ShipKind,
): PlacementCheck {
  const spec = FLEET_BY_KIND[placement.kind]
  if (!spec) return { ok: false, problem: 'unknown-ship' }
  const others = existing.filter((s) => s.kind !== ignoreKind)
  if (others.some((s) => s.kind === placement.kind)) return { ok: false, problem: 'duplicate' }
  const cells = shipCells(placement.bow, spec.length, placement.orientation)
  if (!cells.every(isInBounds)) return { ok: false, problem: 'out-of-bounds' }
  const taken = new Set(others.flatMap((s) => s.cells.map(coordKey)))
  if (cells.some((c) => taken.has(coordKey(c)))) return { ok: false, problem: 'overlap' }
  return { ok: true }
}

export function isCompleteFleet(ships: readonly PlacedShip[]): boolean {
  if (ships.length !== FLEET.length) return false
  const kinds = new Set(ships.map((s) => s.kind))
  return FLEET.every((spec) => kinds.has(spec.kind))
}

export function emptyShots(): CellState[] {
  return new Array<CellState>(BOARD_SIZE * BOARD_SIZE).fill('unknown')
}

/** Build a board from a full, valid fleet. Throws on any rule violation. */
export function createBoard(placements: readonly ShipPlacement[]): Board {
  const ships: PlacedShip[] = []
  for (const placement of placements) {
    const check = checkPlacement(ships, placement)
    if (!check.ok) {
      throw new Error(`Invalid placement for ${placement.kind}: ${check.problem}`)
    }
    ships.push(placeShip(placement))
  }
  if (!isCompleteFleet(ships)) {
    throw new Error(`Fleet must contain exactly one of each ship (${FLEET.length} ships)`)
  }
  return { ships, shots: emptyShots() }
}

export function randomFleet(rng: Rng): ShipPlacement[] {
  const ships: PlacedShip[] = []
  const placements: ShipPlacement[] = []
  for (const spec of FLEET) {
    const options: ShipPlacement[] = []
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (const orientation of ['horizontal', 'vertical'] as const) {
          const candidate: ShipPlacement = { kind: spec.kind, bow: { row, col }, orientation }
          if (checkPlacement(ships, candidate).ok) options.push(candidate)
        }
      }
    }
    const chosen = rng.pick(options)
    placements.push(chosen)
    ships.push(placeShip(chosen))
  }
  return placements
}

export function shipAt(board: Board, coord: Coord): PlacedShip | undefined {
  return board.ships.find((s) => s.cells.some((c) => coordEquals(c, coord)))
}

export function isShipSunk(board: Board, ship: PlacedShip): boolean {
  return ship.cells.every((c) => board.shots[toIndex(c)] === 'hit')
}

export function sunkShips(board: Board): SunkShip[] {
  return board.ships
    .filter((s) => isShipSunk(board, s))
    .map((s) => ({ kind: s.kind, length: s.cells.length, cells: s.cells }))
}

export function allShipsSunk(board: Board): boolean {
  return board.ships.every((s) => isShipSunk(board, s))
}

export function shotAt(board: Board, coord: Coord): CellState {
  return board.shots[toIndex(coord)] ?? 'unknown'
}

export function canFireAt(board: Board, coord: Coord): boolean {
  return isInBounds(coord) && shotAt(board, coord) === 'unknown'
}

/** Resolve a shot. Returns a new board; never mutates. Throws on an illegal shot. */
export function fire(board: Board, coord: Coord): { board: Board; result: ShotResult } {
  if (!isInBounds(coord)) throw new Error(`Shot out of bounds: ${coord.row},${coord.col}`)
  if (shotAt(board, coord) !== 'unknown') {
    throw new Error(`Cell already fired at: ${coord.row},${coord.col}`)
  }
  const ship = shipAt(board, coord)
  const shots = [...board.shots]
  shots[toIndex(coord)] = ship ? 'hit' : 'miss'
  const next: Board = { ships: board.ships, shots }
  if (!ship) return { board: next, result: { kind: 'miss' } }
  if (isShipSunk(next, ship)) {
    return { board: next, result: { kind: 'hit', ship: ship.kind, sunk: true, cells: ship.cells } }
  }
  return { board: next, result: { kind: 'hit', ship: ship.kind, sunk: false } }
}

export function publicView(board: Board): PublicBoardView {
  const sunk = sunkShips(board)
  const sunkKinds = new Set(sunk.map((s) => s.kind))
  return {
    shots: board.shots,
    sunk,
    remaining: FLEET.filter((spec) => !sunkKinds.has(spec.kind)),
  }
}

export function countShots(board: Board): number {
  return board.shots.filter((s) => s !== 'unknown').length
}

export function countHits(board: Board): number {
  return board.shots.filter((s) => s === 'hit').length
}
