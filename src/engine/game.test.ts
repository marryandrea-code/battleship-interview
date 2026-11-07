import { describe, expect, it } from 'vitest'
import { createGame, hitsBy, opponentOf, shotsBy, startGame, takeShot } from './game'
import { randomFleet } from './board'
import { createRng } from './rng'
import type { ShipPlacement } from './types'

const FLEET_A: ShipPlacement[] = [
  { kind: 'carrier', bow: { row: 0, col: 0 }, orientation: 'horizontal' },
  { kind: 'battleship', bow: { row: 1, col: 0 }, orientation: 'horizontal' },
  { kind: 'cruiser', bow: { row: 2, col: 0 }, orientation: 'horizontal' },
  { kind: 'submarine', bow: { row: 3, col: 0 }, orientation: 'horizontal' },
  { kind: 'destroyer', bow: { row: 4, col: 0 }, orientation: 'horizontal' },
]

function playingGame() {
  return startGame(createGame(FLEET_A), randomFleet(createRng(5)))
}

describe('game state machine', () => {
  it('starts in the placing phase with only the AI board set', () => {
    const game = createGame(FLEET_A)
    expect(game.phase).toBe('placing')
    expect(game.boards.player).toBeNull()
    expect(game.boards.ai.ships).toHaveLength(5)
  })

  it('moves to playing once the player fleet is placed', () => {
    const game = playingGame()
    expect(game.phase).toBe('playing')
    expect(game.turn).toBe('player')
    expect(game.boards.player?.ships).toHaveLength(5)
  })

  it('can let the AI go first', () => {
    const game = startGame(createGame(FLEET_A), FLEET_A, 'ai')
    expect(game.turn).toBe('ai')
  })

  it('refuses to start twice or fire before starting', () => {
    const game = createGame(FLEET_A)
    expect(() => takeShot(game, 'player', { row: 0, col: 0 })).toThrow(/phase "placing"/)
    const started = startGame(game, FLEET_A)
    expect(() => startGame(started, FLEET_A)).toThrow(/phase "playing"/)
  })

  it('alternates turns and records history', () => {
    let game = playingGame()
    game = takeShot(game, 'player', { row: 0, col: 0 })
    expect(game.turn).toBe('ai')
    expect(game.history).toHaveLength(1)
    expect(game.history[0]?.by).toBe('player')
    expect(game.history[0]?.result.kind).toBe('hit')
    expect(() => takeShot(game, 'player', { row: 0, col: 1 })).toThrow(/not player's turn/)
    game = takeShot(game, 'ai', { row: 9, col: 9 })
    expect(game.turn).toBe('player')
    expect(shotsBy(game, 'player')).toBe(1)
    expect(shotsBy(game, 'ai')).toBe(1)
    expect(hitsBy(game, 'player')).toBe(1)
  })

  it('finishes when a player sinks the whole fleet and blocks further shots', () => {
    let game = playingGame()
    const aiCells = game.boards.ai.ships.flatMap((s) => s.cells)
    let aiMissRow = 9
    let aiMissCol = 0
    for (const cell of aiCells) {
      game = takeShot(game, 'player', cell)
      if (game.phase === 'finished') break
      while (
        game.boards.player!.ships.some((s) =>
          s.cells.some((c) => c.row === aiMissRow && c.col === aiMissCol),
        )
      ) {
        aiMissCol++
        if (aiMissCol === 10) {
          aiMissCol = 0
          aiMissRow--
        }
      }
      game = takeShot(game, 'ai', { row: aiMissRow, col: aiMissCol })
      aiMissCol++
      if (aiMissCol === 10) {
        aiMissCol = 0
        aiMissRow--
      }
    }
    expect(game.phase).toBe('finished')
    expect(game.winner).toBe('player')
    expect(shotsBy(game, 'player')).toBe(17)
    expect(() => takeShot(game, 'ai', { row: 0, col: 0 })).toThrow(/phase "finished"/)
  })

  it('knows opponents', () => {
    expect(opponentOf('player')).toBe('ai')
    expect(opponentOf('ai')).toBe('player')
  })
})
