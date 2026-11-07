import type { Coord, PublicBoardView, ShipPlacement } from '../types'
import type { Rng } from '../rng'

export type AiRank = 'ensign' | 'lieutenant' | 'commander' | 'admiral'

export const AI_RANKS: readonly AiRank[] = ['ensign', 'lieutenant', 'commander', 'admiral']

export interface AiProfile {
  readonly rank: AiRank
  readonly level: number
  readonly name: string
  readonly callsign: string
  readonly bio: string
  /** How the AI plays, in one sentence, shown to the player. */
  readonly tactics: string
  /** Simulated thinking delay in ms, [min, max]. */
  readonly thinkMs: readonly [number, number]
}

/**
 * An AI opponent. It only ever receives a PublicBoardView, so it cannot see
 * where the player's unsunk ships are.
 */
export interface AiStrategy {
  readonly rank: AiRank
  placeFleet(rng: Rng): ShipPlacement[]
  chooseShot(view: PublicBoardView, rng: Rng): Coord
}
