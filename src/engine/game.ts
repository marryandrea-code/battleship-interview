import { allShipsSunk, createBoard, fire } from './board'
import type { Board, Coord, ShipPlacement, ShotResult } from './types'

export type Player = 'player' | 'ai'
export type Phase = 'placing' | 'playing' | 'finished'

export interface ShotEvent {
  readonly by: Player
  readonly coord: Coord
  readonly result: ShotResult
}

export interface GameState {
  readonly phase: Phase
  /** Who fires next. Meaningless while placing. */
  readonly turn: Player
  /** Each player's own board (their ships, the opponent's shots). */
  readonly boards: { readonly player: Board | null; readonly ai: Board }
  readonly winner: Player | null
  readonly history: readonly ShotEvent[]
}

export function opponentOf(player: Player): Player {
  return player === 'player' ? 'ai' : 'player'
}

export function createGame(aiFleet: readonly ShipPlacement[]): GameState {
  return {
    phase: 'placing',
    turn: 'player',
    boards: { player: null, ai: createBoard(aiFleet) },
    winner: null,
    history: [],
  }
}

export function startGame(
  state: GameState,
  playerFleet: readonly ShipPlacement[],
  first: Player = 'player',
): GameState {
  if (state.phase !== 'placing') throw new Error(`Cannot start a game in phase "${state.phase}"`)
  return {
    ...state,
    phase: 'playing',
    turn: first,
    boards: { ...state.boards, player: createBoard(playerFleet) },
  }
}

export function takeShot(state: GameState, by: Player, coord: Coord): GameState {
  if (state.phase !== 'playing') throw new Error(`Cannot fire in phase "${state.phase}"`)
  if (state.turn !== by) throw new Error(`It is not ${by}'s turn`)
  const target = opponentOf(by)
  const targetBoard = state.boards[target]
  if (!targetBoard) throw new Error('Target board is missing')
  const { board, result } = fire(targetBoard, coord)
  const won = allShipsSunk(board)
  return {
    phase: won ? 'finished' : 'playing',
    turn: won ? by : target,
    boards: { ...state.boards, [target]: board },
    winner: won ? by : null,
    history: [...state.history, { by, coord, result }],
  }
}

export function shotsBy(state: GameState, player: Player): number {
  return state.history.filter((e) => e.by === player).length
}

export function hitsBy(state: GameState, player: Player): number {
  return state.history.filter((e) => e.by === player && e.result.kind === 'hit').length
}
