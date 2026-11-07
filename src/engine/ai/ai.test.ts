import { describe, expect, it } from 'vitest'
import { createBoard, fire, publicView, randomFleet } from '../board'
import { createRng } from '../rng'
import { FLEET, coordKey, isInBounds, toIndex, type Board, type ShipPlacement } from '../types'
import { AI_RANKS, getStrategy } from './index'
import { activeHits, densityMap, jointDensity } from './analysis'
import { parityCandidates, targetCandidates } from './huntTarget'
import { spreadFleet } from './strategies'
import { benchmarkMatchup, benchmarkRank, shotsToSink } from './simulate'

const FLEET_A: ShipPlacement[] = [
  { kind: 'carrier', bow: { row: 0, col: 0 }, orientation: 'horizontal' },
  { kind: 'battleship', bow: { row: 1, col: 0 }, orientation: 'horizontal' },
  { kind: 'cruiser', bow: { row: 2, col: 0 }, orientation: 'horizontal' },
  { kind: 'submarine', bow: { row: 3, col: 0 }, orientation: 'horizontal' },
  { kind: 'destroyer', bow: { row: 4, col: 0 }, orientation: 'horizontal' },
]

describe.each(AI_RANKS)('%s', (rank) => {
  const strategy = getStrategy(rank)

  it('places a valid fleet', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(() => createBoard(strategy.placeFleet(createRng(seed)))).not.toThrow()
    }
  })

  it('never fires out of bounds or at the same cell twice, and always finishes', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed)
      let board: Board = createBoard(randomFleet(rng))
      const fired = new Set<string>()
      for (let shots = 0; shots < 100; shots++) {
        const coord = strategy.chooseShot(publicView(board), rng)
        expect(isInBounds(coord)).toBe(true)
        expect(fired.has(coordKey(coord))).toBe(false)
        fired.add(coordKey(coord))
        board = fire(board, coord).board
        if (board.ships.every((s) => s.cells.every((c) => board.shots[toIndex(c)] === 'hit'))) break
      }
      expect(
        board.ships.every((s) => s.cells.every((c) => board.shots[toIndex(c)] === 'hit')),
      ).toBe(true)
    }
  })

  it('is deterministic for a given seed', () => {
    const a = shotsToSink(strategy, FLEET_A, createRng(11))
    const b = shotsToSink(strategy, FLEET_A, createRng(11))
    expect(a).toBe(b)
  })
})

describe('targeting helpers', () => {
  it('reports active hits only for ships still afloat', () => {
    let board = createBoard(FLEET_A)
    board = fire(board, { row: 4, col: 0 }).board
    board = fire(board, { row: 0, col: 0 }).board
    expect(activeHits(publicView(board))).toHaveLength(2)
    board = fire(board, { row: 4, col: 1 }).board
    expect(activeHits(publicView(board))).toEqual([{ row: 0, col: 0 }])
  })

  it('tries neighbours after one hit and extends the line after two', () => {
    let board = createBoard(FLEET_A)
    board = fire(board, { row: 2, col: 1 }).board
    expect(targetCandidates(publicView(board)).map(coordKey).sort()).toEqual(
      ['1,1', '3,1', '2,0', '2,2'].sort(),
    )
    board = fire(board, { row: 2, col: 2 }).board
    expect(targetCandidates(publicView(board)).map(coordKey).sort()).toEqual(['2,0', '2,3'].sort())
  })

  it('falls back to neighbours when both ends of a line are blocked', () => {
    let board = createBoard(FLEET_A)
    board = fire(board, { row: 0, col: 3 }).board
    board = fire(board, { row: 1, col: 3 }).board
    expect(targetCandidates(publicView(board)).map(coordKey)).toEqual(['2,3'])
    board = fire(board, { row: 2, col: 3 }).board
    expect(activeHits(publicView(board))).toHaveLength(2)
    expect(targetCandidates(publicView(board)).map(coordKey).sort()).toEqual(
      ['0,2', '0,4', '1,2', '1,4'].sort(),
    )
  })

  it('hunts on a checkerboard while the destroyer is afloat', () => {
    const board = createBoard(FLEET_A)
    const cells = parityCandidates(publicView(board))
    expect(cells).toHaveLength(50)
    expect(cells.every((c) => (c.row + c.col) % 2 === 0)).toBe(true)
  })

  it('density is zero on fired cells and highest where the most ships fit', () => {
    const board = createBoard(FLEET_A)
    const density = densityMap(publicView(board), { hitWeight: 1, requireHit: false })
    const corner = density[toIndex({ row: 0, col: 0 })]!
    const centre = density[toIndex({ row: 4, col: 4 })]!
    expect(centre).toBeGreaterThan(corner)
    const after = fire(board, { row: 4, col: 4 }).board
    expect(
      densityMap(publicView(after), { hitWeight: 1, requireHit: false })[
        toIndex({ row: 4, col: 4 })
      ],
    ).toBe(0)
  })

  it('joint density respects the budget and only counts arrangements covering every hit', () => {
    let board = createBoard(FLEET_A)
    expect(jointDensity(publicView(board), 1000)).toBeNull()
    for (const ship of board.ships.slice(0, 4)) {
      for (const c of ship.cells) board = fire(board, c).board
    }
    board = fire(board, { row: 4, col: 0 }).board
    const density = jointDensity(publicView(board), 1000)
    expect(density).not.toBeNull()
    const expectedNeighbours = ['4,1', '5,0']
    const nonZero = density!
      .map((v, i) => (v > 0 ? i : -1))
      .filter((i) => i >= 0)
      .map((i) => coordKey({ row: Math.floor(i / 10), col: i % 10 }))
    expect(nonZero.sort()).toEqual(expectedNeighbours.sort())
  })

  it('spreadFleet never lets ships touch', () => {
    for (let seed = 0; seed < 50; seed++) {
      const board = createBoard(spreadFleet(createRng(seed)))
      expect(board.ships).toHaveLength(FLEET.length)
      for (const a of board.ships) {
        for (const b of board.ships) {
          if (a === b) continue
          for (const ca of a.cells) {
            for (const cb of b.cells) {
              expect(
                Math.max(Math.abs(ca.row - cb.row), Math.abs(ca.col - cb.col)),
              ).toBeGreaterThan(1)
            }
          }
        }
      }
    }
  })
})

describe('difficulty ordering', () => {
  const GAMES = 40

  it('each rank clears a fleet in fewer shots than the one below', () => {
    const [ensign, lieutenant, commander, admiral] = AI_RANKS.map((r) =>
      benchmarkRank(r, GAMES, 2024),
    )
    expect(ensign!.meanShots).toBeGreaterThan(85)
    expect(lieutenant!.meanShots).toBeLessThan(ensign!.meanShots - 25)
    expect(commander!.meanShots).toBeLessThan(lieutenant!.meanShots)
    expect(admiral!.meanShots).toBeLessThan(commander!.meanShots)
    expect(admiral!.meanShots).toBeLessThan(48)
  })

  it('higher ranks win most head-to-head games', () => {
    expect(benchmarkMatchup('lieutenant', 'ensign', GAMES, 7).aWinRate).toBeGreaterThan(0.9)
    expect(benchmarkMatchup('commander', 'lieutenant', GAMES, 7).aWinRate).toBeGreaterThan(0.5)
    expect(benchmarkMatchup('admiral', 'commander', GAMES, 7).aWinRate).toBeGreaterThan(0.5)
  })
})
