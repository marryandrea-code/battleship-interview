import { describe, expect, it } from 'vitest'
import {
  allShipsSunk,
  canFireAt,
  checkPlacement,
  countHits,
  countShots,
  createBoard,
  fire,
  isCompleteFleet,
  placeShip,
  publicView,
  randomFleet,
  shipCells,
  sunkShips,
} from './board'
import { createRng } from './rng'
import { BOARD_SIZE, FLEET, coordKey, type ShipPlacement } from './types'

const STANDARD_FLEET: ShipPlacement[] = [
  { kind: 'carrier', bow: { row: 0, col: 0 }, orientation: 'horizontal' },
  { kind: 'battleship', bow: { row: 1, col: 0 }, orientation: 'horizontal' },
  { kind: 'cruiser', bow: { row: 2, col: 0 }, orientation: 'horizontal' },
  { kind: 'submarine', bow: { row: 3, col: 0 }, orientation: 'horizontal' },
  { kind: 'destroyer', bow: { row: 4, col: 0 }, orientation: 'horizontal' },
]

describe('shipCells', () => {
  it('lays cells out horizontally and vertically from the bow', () => {
    expect(shipCells({ row: 2, col: 3 }, 3, 'horizontal')).toEqual([
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 2, col: 5 },
    ])
    expect(shipCells({ row: 2, col: 3 }, 2, 'vertical')).toEqual([
      { row: 2, col: 3 },
      { row: 3, col: 3 },
    ])
  })
})

describe('checkPlacement', () => {
  it('accepts a ship fully inside the board', () => {
    expect(
      checkPlacement([], { kind: 'carrier', bow: { row: 0, col: 5 }, orientation: 'horizontal' }),
    ).toEqual({ ok: true })
    expect(
      checkPlacement([], { kind: 'carrier', bow: { row: 5, col: 9 }, orientation: 'vertical' }),
    ).toEqual({ ok: true })
  })

  it('rejects ships that run off the board', () => {
    expect(
      checkPlacement([], { kind: 'carrier', bow: { row: 0, col: 6 }, orientation: 'horizontal' }),
    ).toEqual({ ok: false, problem: 'out-of-bounds' })
    expect(
      checkPlacement([], { kind: 'destroyer', bow: { row: 9, col: 0 }, orientation: 'vertical' }),
    ).toEqual({ ok: false, problem: 'out-of-bounds' })
    expect(
      checkPlacement([], { kind: 'destroyer', bow: { row: -1, col: 0 }, orientation: 'vertical' }),
    ).toEqual({ ok: false, problem: 'out-of-bounds' })
  })

  it('rejects overlaps but allows touching ships', () => {
    const existing = [
      placeShip({ kind: 'cruiser', bow: { row: 5, col: 5 }, orientation: 'horizontal' }),
    ]
    expect(
      checkPlacement(existing, {
        kind: 'destroyer',
        bow: { row: 4, col: 6 },
        orientation: 'vertical',
      }),
    ).toEqual({ ok: false, problem: 'overlap' })
    expect(
      checkPlacement(existing, {
        kind: 'destroyer',
        bow: { row: 6, col: 5 },
        orientation: 'horizontal',
      }),
    ).toEqual({ ok: true })
  })

  it('rejects a second ship of the same kind unless it is being moved', () => {
    const existing = [
      placeShip({ kind: 'cruiser', bow: { row: 5, col: 5 }, orientation: 'horizontal' }),
    ]
    const moved: ShipPlacement = {
      kind: 'cruiser',
      bow: { row: 0, col: 0 },
      orientation: 'vertical',
    }
    expect(checkPlacement(existing, moved)).toEqual({ ok: false, problem: 'duplicate' })
    expect(checkPlacement(existing, moved, 'cruiser')).toEqual({ ok: true })
  })

  it('lets a moved ship overlap its own old position', () => {
    const existing = [
      placeShip({ kind: 'cruiser', bow: { row: 5, col: 5 }, orientation: 'horizontal' }),
    ]
    expect(
      checkPlacement(
        existing,
        { kind: 'cruiser', bow: { row: 5, col: 5 }, orientation: 'vertical' },
        'cruiser',
      ),
    ).toEqual({ ok: true })
  })
})

describe('createBoard', () => {
  it('builds a board with an empty shot grid', () => {
    const board = createBoard(STANDARD_FLEET)
    expect(board.ships).toHaveLength(FLEET.length)
    expect(board.shots).toHaveLength(BOARD_SIZE * BOARD_SIZE)
    expect(board.shots.every((s) => s === 'unknown')).toBe(true)
  })

  it('rejects incomplete, duplicated, or overlapping fleets', () => {
    expect(() => createBoard(STANDARD_FLEET.slice(0, 4))).toThrow(/exactly one of each ship/)
    expect(() =>
      createBoard([
        ...STANDARD_FLEET.slice(0, 4),
        { ...STANDARD_FLEET[0]!, bow: { row: 9, col: 0 } },
      ]),
    ).toThrow(/duplicate/)
    expect(() =>
      createBoard([
        ...STANDARD_FLEET.slice(0, 4),
        { ...STANDARD_FLEET[4]!, bow: { row: 0, col: 0 } },
      ]),
    ).toThrow(/overlap/)
  })
})

describe('randomFleet', () => {
  it('always produces a valid, complete fleet', () => {
    for (let seed = 0; seed < 200; seed++) {
      const placements = randomFleet(createRng(seed))
      const board = createBoard(placements)
      expect(isCompleteFleet(board.ships)).toBe(true)
      const cells = board.ships.flatMap((s) => s.cells.map(coordKey))
      expect(new Set(cells).size).toBe(17)
    }
  })

  it('is reproducible from the seed', () => {
    expect(randomFleet(createRng(99))).toEqual(randomFleet(createRng(99)))
  })
})

describe('fire', () => {
  it('reports a miss and records it without mutating the original board', () => {
    const board = createBoard(STANDARD_FLEET)
    const { board: next, result } = fire(board, { row: 9, col: 9 })
    expect(result).toEqual({ kind: 'miss' })
    expect(next.shots[99]).toBe('miss')
    expect(board.shots[99]).toBe('unknown')
  })

  it('reports a hit, then a sink on the last cell', () => {
    let board = createBoard(STANDARD_FLEET)
    const first = fire(board, { row: 4, col: 0 })
    board = first.board
    expect(first.result).toEqual({ kind: 'hit', ship: 'destroyer', sunk: false })
    expect(sunkShips(board)).toEqual([])

    const second = fire(board, { row: 4, col: 1 })
    expect(second.result).toEqual({
      kind: 'hit',
      ship: 'destroyer',
      sunk: true,
      cells: [
        { row: 4, col: 0 },
        { row: 4, col: 1 },
      ],
    })
    expect(sunkShips(second.board).map((s) => s.kind)).toEqual(['destroyer'])
  })

  it('refuses out-of-bounds and repeated shots', () => {
    const board = createBoard(STANDARD_FLEET)
    expect(() => fire(board, { row: 10, col: 0 })).toThrow(/out of bounds/)
    expect(() => fire(board, { row: 0, col: -1 })).toThrow(/out of bounds/)
    const { board: next } = fire(board, { row: 0, col: 0 })
    expect(() => fire(next, { row: 0, col: 0 })).toThrow(/already fired/)
    expect(canFireAt(next, { row: 0, col: 0 })).toBe(false)
    expect(canFireAt(next, { row: 0, col: 1 })).toBe(true)
    expect(canFireAt(next, { row: 0, col: 10 })).toBe(false)
  })

  it('detects when every ship is sunk', () => {
    let board = createBoard(STANDARD_FLEET)
    for (const ship of board.ships) {
      for (const cell of ship.cells) {
        expect(allShipsSunk(board)).toBe(false)
        board = fire(board, cell).board
      }
    }
    expect(allShipsSunk(board)).toBe(true)
    expect(countShots(board)).toBe(17)
    expect(countHits(board)).toBe(17)
  })
})

describe('publicView', () => {
  it('exposes shots and sunk ships but never unsunk ship positions', () => {
    let board = createBoard(STANDARD_FLEET)
    board = fire(board, { row: 4, col: 0 }).board
    board = fire(board, { row: 4, col: 1 }).board
    board = fire(board, { row: 0, col: 0 }).board
    const view = publicView(board)
    expect(view.sunk.map((s) => s.kind)).toEqual(['destroyer'])
    expect(view.remaining.map((s) => s.kind)).toEqual([
      'carrier',
      'battleship',
      'cruiser',
      'submarine',
    ])
    expect(Object.keys(view)).toEqual(['shots', 'sunk', 'remaining'])
    expect(view.shots[0]).toBe('hit')
  })
})
