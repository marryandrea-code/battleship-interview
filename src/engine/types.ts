export const BOARD_SIZE = 10

export interface Coord {
  readonly row: number
  readonly col: number
}

export type Orientation = 'horizontal' | 'vertical'

export type ShipKind = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer'

export interface ShipSpec {
  readonly kind: ShipKind
  readonly name: string
  readonly length: number
}

export const FLEET: readonly ShipSpec[] = [
  { kind: 'carrier', name: 'Carrier', length: 5 },
  { kind: 'battleship', name: 'Battleship', length: 4 },
  { kind: 'cruiser', name: 'Cruiser', length: 3 },
  { kind: 'submarine', name: 'Submarine', length: 3 },
  { kind: 'destroyer', name: 'Destroyer', length: 2 },
]

export const FLEET_BY_KIND: Readonly<Record<ShipKind, ShipSpec>> = Object.fromEntries(
  FLEET.map((s) => [s.kind, s]),
) as Record<ShipKind, ShipSpec>

export interface ShipPlacement {
  readonly kind: ShipKind
  readonly bow: Coord
  readonly orientation: Orientation
}

export interface PlacedShip extends ShipPlacement {
  readonly cells: readonly Coord[]
}

export type CellState = 'unknown' | 'miss' | 'hit'

/** A full board: the owner's ships plus every shot the opponent has taken at it. */
export interface Board {
  readonly ships: readonly PlacedShip[]
  /** Flat row-major array of BOARD_SIZE * BOARD_SIZE cells. */
  readonly shots: readonly CellState[]
}

export type ShotResult =
  | { readonly kind: 'miss' }
  | { readonly kind: 'hit'; readonly ship: ShipKind; readonly sunk: false }
  | {
      readonly kind: 'hit'
      readonly ship: ShipKind
      readonly sunk: true
      readonly cells: readonly Coord[]
    }

export interface SunkShip {
  readonly kind: ShipKind
  readonly length: number
  readonly cells: readonly Coord[]
}

/** Everything an opponent is allowed to know about a board. */
export interface PublicBoardView {
  readonly shots: readonly CellState[]
  readonly sunk: readonly SunkShip[]
  readonly remaining: readonly ShipSpec[]
}

export function toIndex({ row, col }: Coord): number {
  return row * BOARD_SIZE + col
}

export function fromIndex(index: number): Coord {
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE }
}

export function coordKey({ row, col }: Coord): string {
  return `${row},${col}`
}

export function coordEquals(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col
}

export function isInBounds({ row, col }: Coord): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < BOARD_SIZE &&
    col >= 0 &&
    col < BOARD_SIZE
  )
}

/** "A1" style label used in the UI and logs. */
export function coordLabel({ row, col }: Coord): string {
  return `${String.fromCharCode(65 + row)}${col + 1}`
}
