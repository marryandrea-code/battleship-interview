import { createBoard, fire, publicView } from '../board'
import { createRng, type Rng } from '../rng'
import type { Board, ShipPlacement } from '../types'
import { getStrategy } from './index'
import type { AiRank, AiStrategy } from './types'

/** Shots a strategy needs to sink a given fleet on its own. */
export function shotsToSink(
  strategy: AiStrategy,
  fleet: readonly ShipPlacement[],
  rng: Rng,
): number {
  let board: Board = createBoard(fleet)
  let shots = 0
  while (board.ships.some((s) => s.cells.some((c) => board.shots[c.row * 10 + c.col] !== 'hit'))) {
    const coord = strategy.chooseShot(publicView(board), rng)
    board = fire(board, coord).board
    shots++
    if (shots > 100) throw new Error(`${strategy.rank} did not finish in 100 shots`)
  }
  return shots
}

export interface MatchResult {
  readonly winner: AiRank
  readonly shots: Readonly<Record<'a' | 'b', number>>
}

/** Two strategies alternate shots against each other's fleets; a fires first. */
export function playMatch(a: AiStrategy, b: AiStrategy, rng: Rng): MatchResult {
  const fleets = { a: a.placeFleet(rng), b: b.placeFleet(rng) }
  const boards = { a: createBoard(fleets.a), b: createBoard(fleets.b) }
  const shots = { a: 0, b: 0 }
  for (;;) {
    const aShot = a.chooseShot(publicView(boards.b), rng)
    boards.b = fire(boards.b, aShot).board
    shots.a++
    if (allSunk(boards.b)) return { winner: a.rank, shots }
    const bShot = b.chooseShot(publicView(boards.a), rng)
    boards.a = fire(boards.a, bShot).board
    shots.b++
    if (allSunk(boards.a)) return { winner: b.rank, shots }
  }
}

function allSunk(board: Board): boolean {
  return board.ships.every((s) => s.cells.every((c) => board.shots[c.row * 10 + c.col] === 'hit'))
}

export interface RankStats {
  readonly rank: AiRank
  readonly games: number
  readonly meanShots: number
  readonly minShots: number
  readonly maxShots: number
}

/** Average shots each rank needs to clear a random fleet. */
export function benchmarkRank(rank: AiRank, games: number, seed = 1): RankStats {
  const strategy = getStrategy(rank)
  const rng = createRng(seed)
  let total = 0
  let min = Infinity
  let max = 0
  for (let i = 0; i < games; i++) {
    const n = shotsToSink(strategy, getStrategy('ensign').placeFleet(rng), rng)
    total += n
    min = Math.min(min, n)
    max = Math.max(max, n)
  }
  return { rank, games, meanShots: total / games, minShots: min, maxShots: max }
}

export interface MatchupStats {
  readonly a: AiRank
  readonly b: AiRank
  readonly games: number
  /** Fraction of games won by a. Turn order alternates each game. */
  readonly aWinRate: number
}

export function benchmarkMatchup(a: AiRank, b: AiRank, games: number, seed = 1): MatchupStats {
  const rng = createRng(seed)
  const sa = getStrategy(a)
  const sb = getStrategy(b)
  let aWins = 0
  for (let i = 0; i < games; i++) {
    const result = i % 2 === 0 ? playMatch(sa, sb, rng) : playMatch(sb, sa, rng)
    if (result.winner === a) aWins++
  }
  return { a, b, games, aWinRate: aWins / games }
}
